import { expect } from 'chai';
import { PreviewManager } from '../../src/previewManager';

// ---------------------------------------------------------------------------
// Minimal stub for the VS Code API used by PreviewManager
// ---------------------------------------------------------------------------

function makeManagerWithSpy() {
    const postedMessages: Array<{ command: string; [key: string]: unknown }> = [];

    const webview = {
        html: '',
        cspSource: 'vscode-resource:',
        postMessage: (msg: unknown) => { postedMessages.push(msg as { command: string }); },
        onDidReceiveMessage: (handler: (msg: unknown) => void) => {
            // Expose the handler so tests can simulate incoming messages
            (webview as any)._handler = handler;
            return { dispose: () => {} };
        },
        asWebviewUri: (uri: any) => uri,
    };

    const panel = {
        webview,
        reveal: () => {},
        onDidDispose: (_cb: () => void) => ({ dispose: () => {} }),
        dispose: () => {},
        visible: true,
    };

    const vscode = require('vscode');
    const savedCreate = vscode.window.createWebviewPanel;
    vscode.window.createWebviewPanel = () => panel;

    const ctx = {
        extensionPath: __dirname,
        subscriptions: [],
        workspaceState: { get: () => undefined, update: () => {} },
    } as any;

    const mgr = new PreviewManager(ctx);
    // Trigger show() BEFORE restoring the mock so our spy panel is used
    mgr.show();

    vscode.window.createWebviewPanel = savedCreate;

    function simulate(msg: { command: string; [key: string]: unknown }) {
        (webview as any)._handler?.(msg);
    }

    return { mgr, postedMessages, simulate };
}

// ---------------------------------------------------------------------------
// setBackgroundColor
// ---------------------------------------------------------------------------

describe('PreviewManager — setBackgroundColor()', () => {
    it('sends setBackgroundColor postMessage with the given color', () => {
        const { mgr, postedMessages } = makeManagerWithSpy();
        mgr.setBackgroundColor('#ff0000');
        const msg = postedMessages.find(m => m.command === 'setBackgroundColor');
        expect(msg).to.exist;
        expect(msg!.color).to.equal('#ff0000');
    });
});

// ---------------------------------------------------------------------------
// onBackgroundChange
// ---------------------------------------------------------------------------

describe('PreviewManager — onBackgroundChange()', () => {
    it('fires registered callback when changeBackground message is received', () => {
        const { mgr, simulate } = makeManagerWithSpy();
        const received: string[] = [];
        mgr.onBackgroundChange((color) => received.push(color));

        simulate({ command: 'changeBackground', color: '#aabbcc' });

        expect(received).to.deep.equal(['#aabbcc']);
    });

    it('fires multiple registered callbacks', () => {
        const { mgr, simulate } = makeManagerWithSpy();
        const a: string[] = [];
        const b: string[] = [];
        mgr.onBackgroundChange(c => a.push(c));
        mgr.onBackgroundChange(c => b.push(c));

        simulate({ command: 'changeBackground', color: '#112233' });

        expect(a).to.deep.equal(['#112233']);
        expect(b).to.deep.equal(['#112233']);
    });

    it('does not fire callback after dispose', () => {
        const { mgr, simulate } = makeManagerWithSpy();
        const received: string[] = [];
        const disposable = mgr.onBackgroundChange(c => received.push(c));
        disposable.dispose();

        simulate({ command: 'changeBackground', color: '#ffffff' });

        expect(received).to.have.length(0);
    });

    it('does not call callback when changeBackground message has no color', () => {
        const { mgr, simulate } = makeManagerWithSpy();
        const received: string[] = [];
        mgr.onBackgroundChange(c => received.push(c));

        simulate({ command: 'changeBackground' });

        expect(received).to.have.length(0);
    });
});

// ---------------------------------------------------------------------------
// clearError
// ---------------------------------------------------------------------------

describe('PreviewManager — clearError()', () => {
    it('sends clearError postMessage', () => {
        const { mgr, postedMessages } = makeManagerWithSpy();
        mgr.clearError();
        const msg = postedMessages.find(m => m.command === 'clearError');
        expect(msg).to.exist;
    });

    it('does nothing when panel is not open', () => {
        const ctx = {
            extensionPath: __dirname,
            subscriptions: [],
            workspaceState: { get: () => undefined, update: () => {} },
        } as any;
        const mgr = new PreviewManager(ctx);
        expect(() => mgr.clearError()).to.not.throw();
    });
});

// ---------------------------------------------------------------------------
// show(preserveFocus)
// ---------------------------------------------------------------------------

function makeManagerWithRevealSpy() {
    const revealCalls: Array<{ col: unknown; preserveFocus: boolean | undefined }> = [];
    const postedMessages: Array<{ command: string; [key: string]: unknown }> = [];

    const webview = {
        html: '',
        cspSource: 'vscode-resource:',
        postMessage: (msg: unknown) => { postedMessages.push(msg as { command: string }); },
        onDidReceiveMessage: () => ({ dispose: () => {} }),
        asWebviewUri: (uri: any) => uri,
    };

    const panel = {
        webview,
        reveal: (col: unknown, preserveFocus?: boolean) => {
            revealCalls.push({ col, preserveFocus });
        },
        onDidDispose: (_cb: () => void) => ({ dispose: () => {} }),
        dispose: () => {},
        visible: true,
    };

    const vscode = require('vscode');
    const savedCreate = vscode.window.createWebviewPanel;
    vscode.window.createWebviewPanel = () => panel;

    const ctx = {
        extensionPath: __dirname,
        subscriptions: [],
        workspaceState: { get: () => undefined, update: () => {} },
    } as any;

    const mgr = new PreviewManager(ctx);
    mgr.show(); // Creates the panel (first call does not trigger reveal)

    vscode.window.createWebviewPanel = savedCreate;

    return { mgr, revealCalls, postedMessages };
}

describe('PreviewManager — show(preserveFocus)', () => {
    it('passes preserveFocus=true to panel.reveal() when called with true', () => {
        const { mgr, revealCalls } = makeManagerWithRevealSpy();
        mgr.show(true);
        expect(revealCalls).to.have.length(1);
        expect(revealCalls[0].preserveFocus).to.equal(true);
    });

    it('passes preserveFocus=false to panel.reveal() by default', () => {
        const { mgr, revealCalls } = makeManagerWithRevealSpy();
        mgr.show();
        expect(revealCalls).to.have.length(1);
        expect(revealCalls[0].preserveFocus).to.equal(false);
    });
});

// ---------------------------------------------------------------------------
// VNC postMessage methods
// ---------------------------------------------------------------------------

describe('PreviewManager — startVncMode()', () => {
    it('sends startVnc postMessage with the given wsUrl', () => {
        const { mgr, postedMessages } = makeManagerWithSpy();
        mgr.startVncMode('ws://localhost:6080');
        const msg = postedMessages.find(m => m.command === 'startVnc');
        expect(msg).to.exist;
        expect(msg!.wsUrl).to.equal('ws://localhost:6080');
    });
});

describe('PreviewManager — stopVncMode()', () => {
    it('sends stopVnc postMessage', () => {
        const { mgr, postedMessages } = makeManagerWithSpy();
        mgr.stopVncMode();
        const msg = postedMessages.find(m => m.command === 'stopVnc');
        expect(msg).to.exist;
    });
});

describe('PreviewManager — notifyVncAvailable()', () => {
    it('sends vncAvailable postMessage', () => {
        const { mgr, postedMessages } = makeManagerWithSpy();
        mgr.notifyVncAvailable();
        const msg = postedMessages.find(m => m.command === 'vncAvailable');
        expect(msg).to.exist;
    });
});

describe('PreviewManager — notifyVncReloading()', () => {
    it('sends vncReloading postMessage', () => {
        const { mgr, postedMessages } = makeManagerWithSpy();
        mgr.notifyVncReloading();
        const msg = postedMessages.find(m => m.command === 'vncReloading');
        expect(msg).to.exist;
    });
});

describe('PreviewManager — notifyVncReloaded()', () => {
    it('sends vncReloaded postMessage with wsUrl', () => {
        const { mgr, postedMessages } = makeManagerWithSpy();
        mgr.notifyVncReloaded('ws://localhost:6081');
        const msg = postedMessages.find(m => m.command === 'vncReloaded');
        expect(msg).to.exist;
        expect(msg!.wsUrl).to.equal('ws://localhost:6081');
    });
});

// ---------------------------------------------------------------------------
// VNC inbound message callbacks
// ---------------------------------------------------------------------------

describe('PreviewManager — onStartVnc()', () => {
    it('fires callback when startVnc message is received', () => {
        const { mgr, simulate } = makeManagerWithSpy();
        let called = false;
        mgr.onStartVnc(() => { called = true; });
        simulate({ command: 'startVnc' });
        expect(called).to.equal(true);
    });
});

describe('PreviewManager — onStopVnc()', () => {
    it('fires callback when stopVnc message is received', () => {
        const { mgr, simulate } = makeManagerWithSpy();
        let called = false;
        mgr.onStopVnc(() => { called = true; });
        simulate({ command: 'stopVnc' });
        expect(called).to.equal(true);
    });
});

describe('PreviewManager — onVncConnected()', () => {
    it('fires callback when vncConnected message is received', () => {
        const { mgr, simulate } = makeManagerWithSpy();
        let called = false;
        mgr.onVncConnected(() => { called = true; });
        simulate({ command: 'vncConnected' });
        expect(called).to.equal(true);
    });
});

describe('PreviewManager — onVncDisconnected()', () => {
    it('fires callback with reason when vncDisconnected message is received', () => {
        const { mgr, simulate } = makeManagerWithSpy();
        const reasons: string[] = [];
        mgr.onVncDisconnected((r) => reasons.push(r));
        simulate({ command: 'vncDisconnected', reason: 'network error' });
        expect(reasons).to.deep.equal(['network error']);
    });
});

// ---------------------------------------------------------------------------
// updateAnimation
// ---------------------------------------------------------------------------

describe('PreviewManager — updateAnimation()', () => {
    it('sends updateAnimation with isGif=true for a .gif path', () => {
        const { mgr, postedMessages } = makeManagerWithSpy();
        mgr.updateAnimation('/tmp/animation.gif', 1200, 30);
        const msg = postedMessages.find(m => m.command === 'updateAnimation');
        expect(msg).to.exist;
        expect(msg!.isGif).to.equal(true);
        expect(msg!.frameCount).to.equal(30);
        expect(msg!.buildTime).to.equal(1200);
    });

    it('sends updateAnimation with isGif=false for a .png path', () => {
        const { mgr, postedMessages } = makeManagerWithSpy();
        mgr.updateAnimation('/tmp/frame_000.png', 800, 1);
        const msg = postedMessages.find(m => m.command === 'updateAnimation');
        expect(msg).to.exist;
        expect(msg!.isGif).to.equal(false);
    });

    it('does nothing when panel is not open', () => {
        const ctx = {
            extensionPath: __dirname,
            subscriptions: [],
            workspaceState: { get: () => undefined, update: () => {} },
        } as any;
        const mgr = new PreviewManager(ctx);
        expect(() => mgr.updateAnimation('/tmp/animation.gif', 1000, 10)).to.not.throw();
    });
});

// ---------------------------------------------------------------------------
// onAnimationSpeedChange
// ---------------------------------------------------------------------------

describe('PreviewManager — onAnimationSpeedChange()', () => {
    it('fires callback when animationSpeedChange message with speed > 0', () => {
        const { mgr, simulate } = makeManagerWithSpy();
        const speeds: number[] = [];
        mgr.onAnimationSpeedChange(s => speeds.push(s));
        simulate({ command: 'animationSpeedChange', speed: 1.5 });
        expect(speeds).to.deep.equal([1.5]);
    });

    it('does not fire callback when speed <= 0', () => {
        const { mgr, simulate } = makeManagerWithSpy();
        const speeds: number[] = [];
        mgr.onAnimationSpeedChange(s => speeds.push(s));
        simulate({ command: 'animationSpeedChange', speed: 0 });
        simulate({ command: 'animationSpeedChange', speed: -1 });
        expect(speeds).to.have.length(0);
    });

    it('does not fire callback when speed is not a number', () => {
        const { mgr, simulate } = makeManagerWithSpy();
        const speeds: number[] = [];
        mgr.onAnimationSpeedChange(s => speeds.push(s));
        simulate({ command: 'animationSpeedChange', speed: 'fast' });
        expect(speeds).to.have.length(0);
    });

    it('does not fire callback after dispose', () => {
        const { mgr, simulate } = makeManagerWithSpy();
        const speeds: number[] = [];
        const disposable = mgr.onAnimationSpeedChange(s => speeds.push(s));
        disposable.dispose();
        simulate({ command: 'animationSpeedChange', speed: 2.0 });
        expect(speeds).to.have.length(0);
    });
});
