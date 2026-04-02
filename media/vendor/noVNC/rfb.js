/**
 * Minimal RFB (Remote Framebuffer) / VNC client
 * Implements RFB 3.8 over WebSocket (websockify binary proxy).
 * Supports: None security, Raw encoding, CopyRect encoding.
 * Bundled locally for VS Code webview CSP compatibility.
 */

/* global EventTarget, CustomEvent */

const SECURITY_NONE     = 1;
const ENCODING_RAW      = 0;
const ENCODING_COPYRECT = 1;
const ENCODING_ZLIB     = 6;
const ENCODING_ZRLE     = 16;
const ENCODING_DESKTOP_SIZE = -223;

const STATE_HANDSHAKE  = 0;
const STATE_SECURITY   = 1;
const STATE_SEC_RESULT = 2;
const STATE_CLIENT_INIT = 3;
const STATE_SERVER_INIT = 4;
const STATE_NORMAL     = 5;

class RFB extends EventTarget {
    constructor(container, wsUrl, options = {}) {
        super();
        this._container = container;
        this._wsUrl = wsUrl;
        this._options = options;

        this._canvas = document.createElement('canvas');
        this._canvas.style.cursor = 'default';
        this._container.appendChild(this._canvas);
        this._ctx = this._canvas.getContext('2d');

        this._buf = new Uint8Array(0);
        this._state = STATE_HANDSHAKE;
        this._fbWidth = 0;
        this._fbHeight = 0;
        this._ws = null;

        this.scaleViewport = false;
        this.resizeSession = false;
        this.viewOnly = false;

        this._connect();
    }

    // ---- Public API ----

    disconnect() {
        if (this._ws) {
            this._ws.close();
        }
    }

    sendKey(keysym, code, down) {
        if (this.viewOnly || this._state !== STATE_NORMAL) {
            return;
        }
        const buf = new Uint8Array(8);
        buf[0] = 4;          // KeyEvent
        buf[1] = down ? 1 : 0;
        buf[2] = 0; buf[3] = 0;
        const view = new DataView(buf.buffer);
        view.setUint32(4, keysym, false);
        this._sendRaw(buf);
    }

    sendPointerEvent(x, y, mask) {
        if (this.viewOnly || this._state !== STATE_NORMAL) {
            return;
        }
        const buf = new Uint8Array(6);
        const view = new DataView(buf.buffer);
        buf[0] = 5;           // PointerEvent
        buf[1] = mask & 0xFF;
        view.setUint16(2, x, false);
        view.setUint16(4, y, false);
        this._sendRaw(buf);
    }

    // ---- Private: WebSocket ----

    _connect() {
        try {
            this._ws = new WebSocket(this._wsUrl, ['binary']);
            this._ws.binaryType = 'arraybuffer';
            this._ws.onopen    = () => this._onOpen();
            this._ws.onmessage = (e) => this._onData(e.data);
            this._ws.onerror   = (e) => this._onError(e);
            this._ws.onclose   = (e) => this._onClose(e);
        } catch (err) {
            this._emitDisconnect(err.message || String(err));
        }
    }

    _onOpen() {
        // Wait for server to send RFB version string
    }

    _onData(data) {
        const bytes = new Uint8Array(data);
        // Append to buffer
        const merged = new Uint8Array(this._buf.length + bytes.length);
        merged.set(this._buf);
        merged.set(bytes, this._buf.length);
        this._buf = merged;
        this._process();
    }

    _onError(e) {
        this._emitDisconnect('WebSocket error');
    }

    _onClose(e) {
        const clean = e.code === 1000 || e.code === 1001;
        this._emitDisconnect(e.reason || (clean ? 'Normal closure' : 'Connection lost'));
    }

    _sendRaw(data) {
        if (this._ws && this._ws.readyState === WebSocket.OPEN) {
            this._ws.send(data.buffer || data);
        }
    }

    _sendStr(str) {
        const enc = new TextEncoder();
        this._sendRaw(enc.encode(str));
    }

    // ---- Private: Protocol state machine ----

    _process() {
        let again = true;
        while (again) {
            again = false;
            switch (this._state) {
                case STATE_HANDSHAKE:  again = this._handleHandshake();  break;
                case STATE_SECURITY:   again = this._handleSecurity();   break;
                case STATE_SEC_RESULT: again = this._handleSecResult();  break;
                case STATE_CLIENT_INIT: again = this._handleClientInit(); break;
                case STATE_SERVER_INIT: again = this._handleServerInit(); break;
                case STATE_NORMAL:     again = this._handleNormal();     break;
            }
        }
    }

    _consume(n) {
        const data = this._buf.slice(0, n);
        this._buf = this._buf.slice(n);
        return data;
    }

    _u16be(buf, off) {
        return (buf[off] << 8) | buf[off + 1];
    }

    _u32be(buf, off) {
        return ((buf[off] << 24) | (buf[off+1] << 16) | (buf[off+2] << 8) | buf[off+3]) >>> 0;
    }

    _handleHandshake() {
        if (this._buf.length < 12) {
            return false;
        }
        const ver = new TextDecoder().decode(this._buf.slice(0, 12));
        if (!ver.startsWith('RFB ')) {
            this._emitDisconnect('Invalid RFB server version');
            return false;
        }
        this._consume(12);
        // Always reply with 3.8
        this._sendStr('RFB 003.008\n');
        this._state = STATE_SECURITY;
        return true;
    }

    _handleSecurity() {
        if (this._buf.length < 1) {
            return false;
        }
        const count = this._buf[0];
        if (this._buf.length < 1 + count) {
            return false;
        }
        const types = this._consume(1 + count).slice(1);
        if (count === 0) {
            // Server sent error
            this._emitDisconnect('Server rejected connection');
            return false;
        }
        // Choose 'None' (1) if available, else first option
        const chosen = Array.from(types).includes(SECURITY_NONE)
            ? SECURITY_NONE
            : types[0];
        this._sendRaw(new Uint8Array([chosen]));
        if (chosen === SECURITY_NONE) {
            // RFB 3.8: server sends SecurityResult even for None
            this._state = STATE_SEC_RESULT;
        } else {
            this._emitDisconnect(`Unsupported security type: ${chosen}`);
        }
        return true;
    }

    _handleSecResult() {
        if (this._buf.length < 4) {
            return false;
        }
        const result = this._u32be(this._buf, 0);
        this._consume(4);
        if (result !== 0) {
            // Read optional reason
            if (this._buf.length >= 4) {
                const rlen = this._u32be(this._buf, 0);
                if (this._buf.length >= 4 + rlen) {
                    const reason = new TextDecoder().decode(this._buf.slice(4, 4 + rlen));
                    this._emitDisconnect(`Security failed: ${reason}`);
                    return false;
                }
            }
            this._emitDisconnect('Authentication failed');
            return false;
        }
        // Send ClientInit: shared=1
        this._sendRaw(new Uint8Array([1]));
        this._state = STATE_SERVER_INIT;
        return true;
    }

    _handleClientInit() {
        // Nothing to parse here; state advances after sending ClientInit
        this._state = STATE_SERVER_INIT;
        return true;
    }

    _handleServerInit() {
        if (this._buf.length < 24) {
            return false;
        }
        this._fbWidth  = this._u16be(this._buf, 0);
        this._fbHeight = this._u16be(this._buf, 2);
        // bytes 4..19: pixel format (ignored, we request RGBA below)
        const nameLen = this._u32be(this._buf, 20);
        if (this._buf.length < 24 + nameLen) {
            return false;
        }
        this._serverName = new TextDecoder().decode(this._buf.slice(24, 24 + nameLen));
        this._consume(24 + nameLen);

        // Resize canvas
        this._canvas.width  = this._fbWidth;
        this._canvas.height = this._fbHeight;
        this._imageData = this._ctx.createImageData(this._fbWidth, this._fbHeight);

        // Request RGBA pixel format
        this._sendSetPixelFormat();
        // Request Raw + CopyRect + DesktopSize encodings
        this._sendSetEncodings();
        // Initial framebuffer update request (full)
        this._sendFBUpdateRequest(false, 0, 0, this._fbWidth, this._fbHeight);

        this._state = STATE_NORMAL;
        this._emitConnect();
        return true;
    }

    _sendSetPixelFormat() {
        // 32-bit RGBA, 8bpp per component
        const buf = new Uint8Array(20);
        buf[0] = 0;           // SetPixelFormat
        buf[1] = buf[2] = buf[3] = 0; // padding
        buf[4] = 32;          // bits-per-pixel
        buf[5] = 24;          // depth
        buf[6] = 0;           // big-endian
        buf[7] = 1;           // true-colour
        const view = new DataView(buf.buffer);
        view.setUint16(8,  255, false);  // red-max
        view.setUint16(10, 255, false);  // green-max
        view.setUint16(12, 255, false);  // blue-max
        buf[14] = 16;         // red-shift
        buf[15] = 8;          // green-shift
        buf[16] = 0;          // blue-shift
        this._sendRaw(buf);
    }

    _sendSetEncodings() {
        const encs = [ENCODING_RAW, ENCODING_COPYRECT, ENCODING_DESKTOP_SIZE];
        const buf = new Uint8Array(4 + encs.length * 4);
        const view = new DataView(buf.buffer);
        buf[0] = 2;  // SetEncodings
        buf[1] = 0;  // padding
        view.setUint16(2, encs.length, false);
        for (let i = 0; i < encs.length; i++) {
            view.setInt32(4 + i * 4, encs[i], false);
        }
        this._sendRaw(buf);
    }

    _sendFBUpdateRequest(incremental, x, y, w, h) {
        const buf = new Uint8Array(10);
        const view = new DataView(buf.buffer);
        buf[0] = 3;  // FramebufferUpdateRequest
        buf[1] = incremental ? 1 : 0;
        view.setUint16(2, x, false);
        view.setUint16(4, y, false);
        view.setUint16(6, w, false);
        view.setUint16(8, h, false);
        this._sendRaw(buf);
    }

    _handleNormal() {
        if (this._buf.length < 1) {
            return false;
        }
        const msgType = this._buf[0];
        switch (msgType) {
            case 0: return this._handleFBUpdate();
            case 2: return this._handleBell();
            case 3: return this._handleServerCutText();
            default:
                this._emitDisconnect(`Unknown server message type: ${msgType}`);
                return false;
        }
    }

    _handleFBUpdate() {
        if (this._buf.length < 4) {
            return false;
        }
        const numRects = this._u16be(this._buf, 2);
        this._consume(4);

        for (let i = 0; i < numRects; i++) {
            if (this._buf.length < 12) {
                // Put the message header back and wait for more data
                // (simplified: just request again later)
                break;
            }
            const x = this._u16be(this._buf, 0);
            const y = this._u16be(this._buf, 2);
            const w = this._u16be(this._buf, 4);
            const h = this._u16be(this._buf, 6);
            const enc = (this._buf[8] << 24 | this._buf[9] << 16 | this._buf[10] << 8 | this._buf[11]) | 0;
            this._consume(12);

            if (enc === ENCODING_RAW) {
                const pixelBytes = w * h * 4;
                if (this._buf.length < pixelBytes) {
                    // Re-prepend header - wait for complete data
                    // (In a full implementation we'd handle partial rects)
                    break;
                }
                const pixels = this._consume(pixelBytes);
                this._drawRaw(x, y, w, h, pixels);
            } else if (enc === ENCODING_COPYRECT) {
                if (this._buf.length < 4) {
                    break;
                }
                const srcX = this._u16be(this._buf, 0);
                const srcY = this._u16be(this._buf, 2);
                this._consume(4);
                this._drawCopyRect(x, y, w, h, srcX, srcY);
            } else if (enc === ENCODING_DESKTOP_SIZE) {
                this._fbWidth  = w;
                this._fbHeight = h;
                this._canvas.width  = w;
                this._canvas.height = h;
                this._imageData = this._ctx.createImageData(w, h);
            }
        }

        // Request next incremental update
        this._sendFBUpdateRequest(true, 0, 0, this._fbWidth, this._fbHeight);
        return this._buf.length > 0;
    }

    _drawRaw(x, y, w, h, pixels) {
        if (!this._imageData || w <= 0 || h <= 0) {
            return;
        }
        const tmpData = this._ctx.createImageData(w, h);
        for (let i = 0; i < w * h; i++) {
            // Server sends in the pixel format we requested (RGBA little-endian in 32-bit)
            // With our SetPixelFormat: red-shift=16, green-shift=8, blue-shift=0
            // Each 4-byte block: B G R _ (little-endian 32-bit)
            const base = i * 4;
            tmpData.data[base]     = pixels[base + 2]; // R
            tmpData.data[base + 1] = pixels[base + 1]; // G
            tmpData.data[base + 2] = pixels[base];     // B
            tmpData.data[base + 3] = 255;              // A
        }
        this._ctx.putImageData(tmpData, x, y);
    }

    _drawCopyRect(x, y, w, h, srcX, srcY) {
        const src = this._ctx.getImageData(srcX, srcY, w, h);
        this._ctx.putImageData(src, x, y);
    }

    _handleBell() {
        this._consume(1);
        return true;
    }

    _handleServerCutText() {
        if (this._buf.length < 8) {
            return false;
        }
        const len = this._u32be(this._buf, 4);
        if (this._buf.length < 8 + len) {
            return false;
        }
        this._consume(8 + len);
        return true;
    }

    _emitConnect() {
        this.dispatchEvent(new CustomEvent('connect', { detail: { serverName: this._serverName } }));
    }

    _emitDisconnect(reason) {
        this.dispatchEvent(new CustomEvent('disconnect', { detail: { clean: false, reason } }));
    }
}

// Export for use in preview.html
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RFB;
} else {
    window.RFB = RFB;
}
