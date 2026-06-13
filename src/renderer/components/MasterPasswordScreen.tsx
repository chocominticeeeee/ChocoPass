import React, { useState } from "react";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import avatarUrl from "../assets/アバター透過.png";
import logoUrl from "../assets/logo.png";

interface MasterPasswordScreenProps {
    /** true: 初回設定モード / false: ロック解除モード */
    mode: "setup" | "unlock";
    /** 認証に成功（解除/設定完了）したとき。entries を受け取る */
    onUnlocked: (entries: import("../../services/keepassImporter").PasswordEntry[]) => void;
}

export function MasterPasswordScreen({ mode, onUnlocked }: MasterPasswordScreenProps) {
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [show, setShow] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const isSetup = mode === "setup";

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!password) {
            setError("マスターパスワードを入力してください");
            return;
        }

        if (isSetup) {
            if (password.length < 8) {
                setError("マスターパスワードは8文字以上にしてください");
                return;
            }
            if (password !== confirm) {
                setError("確認用パスワードが一致しません");
                return;
            }
        }

        setBusy(true);
        try {
            if (isSetup) {
                const res = await window.electron?.ipc.invoke("setup-master", password);
                if (res?.ok) {
                    onUnlocked(res.entries ?? []);
                } else {
                    setError("設定に失敗しました");
                }
            } else {
                const res = await window.electron?.ipc.invoke("unlock-vault", password);
                if (res?.ok) {
                    onUnlocked(res.entries ?? []);
                } else {
                    setError("マスターパスワードが正しくありません");
                    setPassword("");
                }
            }
        } catch {
            setError("予期しないエラーが発生しました");
        } finally {
            setBusy(false);
        }
    };

    const inputClass =
        "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-11 text-slate-100 placeholder:text-slate-500 transition focus:border-cyan-400/50 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-400/20";

    return (
        <div className="flex h-full w-full items-center justify-center p-6">
            <form onSubmit={submit} className="w-full max-w-sm animate-fade-in">
                {/* ロゴ */}
                <div className="mb-8 flex flex-col items-center text-center">
                    <div className="mb-4 relative flex items-center justify-center h-96">
                        {/* ロゴ */}
                        <img src={logoUrl} alt="ちょこパス" className="h-96 w-auto object-contain" />
                        {/* アバター（ロゴの右に配置） */}
                        <img src={avatarUrl} alt="" className="h-96 w-auto animate-float object-contain absolute right-0" />
                    </div>
                    <p className="mt-1 text-sm text-slate-400">
                        {isSetup
                            ? "マスターパスワードを設定して保管庫を作成します"
                            : "保管庫のロックを解除してください"}
                    </p>
                </div>

                {error && (
                    <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3">
                        <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                        <p className="text-sm text-rose-300">{error}</p>
                    </div>
                )}

                <div className="space-y-3">
                    <div className="relative">
                        <input
                            type={show ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="マスターパスワード"
                            autoFocus
                            className={inputClass}
                        />
                        <button
                            type="button"
                            onClick={() => setShow((s) => !s)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-cyan-300"
                            tabIndex={-1}
                        >
                            {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                    </div>

                    {isSetup && (
                        <input
                            type={show ? "text" : "password"}
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                            placeholder="マスターパスワード（確認）"
                            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100 placeholder:text-slate-500 transition focus:border-cyan-400/50 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
                        />
                    )}
                </div>

                <button
                    type="submit"
                    disabled={busy}
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-violet-500 px-4 py-3 font-semibold text-slate-950 transition hover:shadow-[0_8px_30px_-6px_rgba(34,211,238,0.6)] hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
                >
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    {isSetup ? "保管庫を作成" : "ロック解除"}
                </button>

                {isSetup && (
                    <p className="mt-4 text-center text-xs text-slate-500">
                        マスターパスワードは復元できません。
                        <br />
                        忘れると保管庫を開けなくなるため、安全に保管してください。
                    </p>
                )}
            </form>
        </div>
    );
}
