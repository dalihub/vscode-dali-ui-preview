import * as vscode from 'vscode';

export enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3,
    TRACE = 4,
}

export type LogCategory =
    | 'Extraction'
    | 'Build'
    | 'Compile'
    | 'Execute'
    | 'Parser'
    | 'Server'
    | 'Render'
    | 'Webview'
    | 'VNC'
    | 'Xvfb'
    | 'SDB'
    | 'Config'
    | 'Extension'
    | 'Environment'
    | 'Setup'
    | 'CodeLens'
    | 'Property'
    | 'Cleanup';

export interface Logger {
    error(cat: LogCategory, msg: string, data?: Record<string, unknown>): void;
    warn(cat: LogCategory, msg: string, data?: Record<string, unknown>): void;
    info(cat: LogCategory, msg: string, data?: Record<string, unknown>): void;
    debug(cat: LogCategory, msg: string, data?: Record<string, unknown>): void;
    trace(cat: LogCategory, msg: string, data?: Record<string, unknown>): void;

    /** Create a new operation ID for correlation */
    createOpId(): string;

    /** Set the current operation ID (for the active pipeline) */
    setOpId(opId: string): void;

    /** Get the current operation ID */
    getOpId(): string | undefined;

    /** Update log level from settings */
    setLevel(level: LogLevel): void;
}

const LEVEL_NAMES: Record<LogLevel, string> = {
    [LogLevel.ERROR]: 'ERROR',
    [LogLevel.WARN]: 'WARN',
    [LogLevel.INFO]: 'INFO',
    [LogLevel.DEBUG]: 'DEBUG',
    [LogLevel.TRACE]: 'TRACE',
};

const LEVEL_FROM_STRING: Record<string, LogLevel> = {
    'error': LogLevel.ERROR,
    'warn': LogLevel.WARN,
    'info': LogLevel.INFO,
    'debug': LogLevel.DEBUG,
    'trace': LogLevel.TRACE,
};

class LoggerImpl implements Logger {
    private level: LogLevel;
    private opId: string | undefined;
    private opCounter = 0;
    private configListener: vscode.Disposable;

    constructor(private readonly channel: vscode.OutputChannel) {
        this.level = this.readLevelFromConfig();
        this.configListener = vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('daliPreview.logLevel')) {
                this.level = this.readLevelFromConfig();
            }
        });
    }

    error(cat: LogCategory, msg: string, data?: Record<string, unknown>): void {
        if (this.level < LogLevel.ERROR) { return; }
        const line = `[ERROR] [${cat}] ${msg}`;
        this.channel.appendLine(data ? `${line} data=${JSON.stringify(data)}` : line);
    }

    warn(cat: LogCategory, msg: string, data?: Record<string, unknown>): void {
        if (this.level < LogLevel.WARN) { return; }
        const line = `[WARN] [${cat}] ${msg}`;
        this.channel.appendLine(data ? `${line} data=${JSON.stringify(data)}` : line);
    }

    info(cat: LogCategory, msg: string, data?: Record<string, unknown>): void {
        if (this.level < LogLevel.INFO) { return; }
        const line = `[INFO] [${cat}] ${msg}`;
        this.channel.appendLine(data ? `${line} data=${JSON.stringify(data)}` : line);
    }

    debug(cat: LogCategory, msg: string, data?: Record<string, unknown>): void {
        if (this.level < LogLevel.DEBUG) { return; }
        const opPart = this.opId ? ` [${this.opId}]` : '';
        const line = `[DEBUG] [${cat}]${opPart} ${msg}`;
        this.channel.appendLine(data ? `${line} data=${JSON.stringify(data)}` : line);
    }

    trace(cat: LogCategory, msg: string, data?: Record<string, unknown>): void {
        if (this.level < LogLevel.TRACE) { return; }
        const entry = {
            ts: new Date().toISOString(),
            level: 'TRACE',
            cat,
            opId: this.opId,
            msg,
            data,
        };
        this.channel.appendLine(JSON.stringify(entry));
    }

    createOpId(): string {
        this.opCounter += 1;
        const random = Math.random().toString(36).slice(2, 8);
        const id = `op-${this.opCounter}-${random}`;
        this.opId = id;
        return id;
    }

    setOpId(opId: string): void {
        this.opId = opId;
    }

    getOpId(): string | undefined {
        return this.opId;
    }

    setLevel(level: LogLevel): void {
        this.level = level;
    }

    dispose(): void {
        this.configListener.dispose();
    }

    private readLevelFromConfig(): LogLevel {
        const config = vscode.workspace.getConfiguration('daliPreview');
        const raw = config.get<string>('logLevel', 'info').toLowerCase();
        return LEVEL_FROM_STRING[raw] ?? LogLevel.INFO;
    }
}

let instance: LoggerImpl | undefined;

/** Initialize the logger with an OutputChannel. Call once in activate(). */
export function initLogger(outputChannel: vscode.OutputChannel): Logger {
    if (instance) {
        instance.dispose();
    }
    instance = new LoggerImpl(outputChannel);
    return instance;
}

/** Get the singleton logger instance. Throws if not initialized. */
export function getLogger(): Logger {
    if (!instance) {
        throw new Error('Logger not initialized. Call initLogger() first.');
    }
    return instance;
}
