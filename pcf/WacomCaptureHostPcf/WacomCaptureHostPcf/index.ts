import { IInputs, IOutputs } from "./generated/ManifestTypes";

interface CaptureCompletePayload {
    imageBase64?: string;
    imageDataUrl?: string;
    sigObjBase64?: string;
    signerName?: string;
    reason?: string;
    where?: string;
    strokeCount?: number;
    capturedAtUtc?: string;
    mime?: string;
}

interface CaptureErrorPayload {
    code?: string;
    message?: string;
}

type IframeMessage =
    | { type: "wacom-stu540:ready"; payload?: { sdkLoaded?: boolean; sdkSource?: string | null } }
    | { type: "wacom-stu540:capture-started"; payload?: unknown }
    | { type: "wacom-stu540:capture-complete"; payload: CaptureCompletePayload }
    | { type: "wacom-stu540:capture-cancelled"; payload?: CaptureErrorPayload }
    | { type: "wacom-stu540:capture-error"; payload?: CaptureErrorPayload };

type CommandKind = "start" | "cancel" | "clear" | "submit";
const VALID_COMMANDS: readonly CommandKind[] = ["start", "cancel", "clear", "submit"];

export class WacomCaptureHostPcf
    implements ComponentFramework.StandardControl<IInputs, IOutputs> {
    private container!: HTMLDivElement;
    private iframe!: HTMLIFrameElement;
    private overlay!: HTMLDivElement;
    private notifyOutputChanged!: () => void;
    private context!: ComponentFramework.Context<IInputs>;

    private currentIframeUrl = "";
    private currentIframeOrigin = "";
    private commandConsumed = "";

    private status = "Loading";
    private imageDataUrl = "";
    private imageBase64 = "";
    private sigObjBase64 = "";
    private strokeCount = 0;
    private capturedAtUtc: Date | null = null;
    private lastError = "";

    private readonly messageListener = (event: MessageEvent): void => {
        if (!this.currentIframeOrigin) return;
        if (event.origin !== this.currentIframeOrigin) return;
        const data = event.data as IframeMessage | null;
        if (!data || typeof data !== "object" || typeof data.type !== "string") return;
        if (!data.type.startsWith("wacom-stu540:")) return;
        this.handleMessage(data);
    };

    public init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void,
        _state: ComponentFramework.Dictionary,
        container: HTMLDivElement,
    ): void {
        this.context = context;
        this.notifyOutputChanged = notifyOutputChanged;

        this.container = document.createElement("div");
        this.container.className = "bbol-wacom-host";
        container.appendChild(this.container);

        this.iframe = document.createElement("iframe");
        this.iframe.setAttribute("allow", "hid; clipboard-write");
        this.iframe.setAttribute("title", "Wacom STU-540 capture");
        this.iframe.setAttribute("loading", "eager");
        this.container.appendChild(this.iframe);

        this.overlay = document.createElement("div");
        this.overlay.className = "bbol-overlay";
        this.overlay.textContent = "Cargando…";
        this.container.appendChild(this.overlay);

        window.addEventListener("message", this.messageListener);

        this.applyContext(context, /*isInit*/ true);
    }

    public updateView(context: ComponentFramework.Context<IInputs>): void {
        this.context = context;
        this.applyContext(context, /*isInit*/ false);
    }

    public getOutputs(): IOutputs {
        return {
            Status: this.status,
            ImageDataUrl: this.imageDataUrl,
            ImageBase64: this.imageBase64,
            SigObjBase64: this.sigObjBase64,
            StrokeCount: this.strokeCount,
            CapturedAtUtc: this.capturedAtUtc ?? undefined,
            LastError: this.lastError,
            Command: "",
        };
    }

    public destroy(): void {
        window.removeEventListener("message", this.messageListener);
    }

    // ── private ─────────────────────────────────────────────────────

    private applyContext(
        context: ComponentFramework.Context<IInputs>,
        isInit: boolean,
    ): void {
        const url = (context.parameters.IframeUrl?.raw ?? "").trim();
        if (!url) {
            this.iframe.style.display = "none";
            this.overlay.classList.add("bbol-error");
            this.overlay.textContent = "Configurá la propiedad IframeUrl con la URL de capture.html.";
            this.status = "Error";
            this.lastError = "IframeUrl is empty";
            this.notifyOutputChanged();
            return;
        }

        const targetUrl = this.composeIframeUrl(url, context);
        if (isInit || targetUrl !== this.currentIframeUrl) {
            this.currentIframeUrl = targetUrl;
            try {
                this.currentIframeOrigin = new URL(targetUrl, window.location.href).origin;
            } catch {
                this.currentIframeOrigin = "";
            }
            this.iframe.src = targetUrl;
            this.iframe.style.display = "";
            this.overlay.classList.remove("bbol-error");
            this.overlay.style.display = "";
            this.overlay.textContent = "Cargando…";
            this.status = "Loading";
            this.notifyOutputChanged();
        }

        this.maybeDispatchCommand(context);
    }

    private composeIframeUrl(
        rawUrl: string,
        context: ComponentFramework.Context<IInputs>,
    ): string {
        let base: URL;
        try {
            base = new URL(rawUrl, window.location.href);
        } catch {
            return rawUrl;
        }
        const params = base.searchParams;
        const setIf = (key: string, value: string | undefined): void => {
            if (value && value.trim().length > 0) {
                params.set(key, value);
            }
        };
        setIf("signer", context.parameters.SignerName?.raw ?? undefined);
        setIf("reason", context.parameters.Reason?.raw ?? undefined);
        setIf("location", context.parameters.Location?.raw ?? undefined);
        setIf("license", context.parameters.License?.raw ?? undefined);

        const autoStartRaw = context.parameters.AutoStart?.raw;
        params.set("autoStart", autoStartRaw === false ? "false" : "true");

        params.set("parentOrigin", window.location.origin);
        return base.toString();
    }

    private maybeDispatchCommand(context: ComponentFramework.Context<IInputs>): void {
        const cmd = (context.parameters.Command?.raw ?? "").trim().toLowerCase();
        if (!cmd || cmd === this.commandConsumed) return;
        if ((VALID_COMMANDS as readonly string[]).indexOf(cmd) < 0) return;
        this.commandConsumed = cmd;
        this.postToIframe(`wacom-stu540:${cmd}`);
        this.notifyOutputChanged();
    }

    private postToIframe(type: string): void {
        if (!this.iframe.contentWindow || !this.currentIframeOrigin) return;
        try {
            this.iframe.contentWindow.postMessage({ type }, this.currentIframeOrigin);
        } catch {
            // ignore
        }
    }

    private handleMessage(msg: IframeMessage): void {
        switch (msg.type) {
            case "wacom-stu540:ready":
                this.overlay.style.display = "none";
                this.status = "Ready";
                this.lastError = "";
                this.notifyOutputChanged();
                break;
            case "wacom-stu540:capture-started":
                this.status = "Capturing";
                this.lastError = "";
                this.notifyOutputChanged();
                break;
            case "wacom-stu540:capture-complete": {
                const p = msg.payload ?? {};
                this.imageDataUrl = p.imageDataUrl ?? "";
                this.imageBase64 = p.imageBase64 ?? "";
                this.sigObjBase64 = p.sigObjBase64 ?? "";
                this.strokeCount = typeof p.strokeCount === "number" ? p.strokeCount : 0;
                this.capturedAtUtc = p.capturedAtUtc ? new Date(p.capturedAtUtc) : new Date();
                this.status = "Captured";
                this.lastError = "";
                this.notifyOutputChanged();
                break;
            }
            case "wacom-stu540:capture-cancelled":
                this.status = "Cancelled";
                this.lastError = msg.payload?.message ?? "User cancelled";
                this.notifyOutputChanged();
                break;
            case "wacom-stu540:capture-error":
                this.status = "Error";
                this.lastError = msg.payload?.message ?? msg.payload?.code ?? "Unknown error";
                this.notifyOutputChanged();
                break;
        }
    }
}
