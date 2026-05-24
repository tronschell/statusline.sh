import { useEffect, useState } from "react";
import { Copy, Check } from "@phosphor-icons/react";
import { api } from "../../lib/api";
import Modal from "../Modal/Modal";

export interface PublishDialogProps {
  designId: string | null;
  designName: string;
  isOpen: boolean;
  onClose(): void;
  /** Trigger the Save & Share flow when designId is null. */
  onRequestSave?(): void;
  /** Called after a successful publish with the assigned slug. */
  onPublished?(slug: string): void;
}

const DESCRIPTION_MAX = 200;
const inputClass =
  "w-full bg-[#1C1C1F] border border-white/[0.06] rounded-[4px] px-3 py-2 text-sm text-[#E8E8E6] focus:outline-none focus:border-[#8FB8DA]";
const labelClass = "text-xs uppercase tracking-wider text-[#8A8A86]";

export default function PublishDialog({
  designId,
  designName,
  isOpen,
  onClose,
  onRequestSave,
  onPublished,
}: PublishDialogProps) {
  const [name, setName] = useState(designName);
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset form state whenever the dialog opens, and pre-fill name.
  useEffect(() => {
    if (isOpen) {
      setName(designName);
      setError(null);
      setBusy(false);
      setPublishedSlug(null);
      setCopied(false);
    }
  }, [isOpen, designName]);

  async function onPublish() {
    if (!designId) return;
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.publish(designId, {
        author_name: author.trim(),
        description: description.trim(),
        name: name.trim() || designName,
      });
      setPublishedSlug(res.slug);
      onPublished?.(res.slug);
    } catch (e) {
      setError((e as Error).message || "Failed to publish");
    } finally {
      setBusy(false);
    }
  }

  const communityPath = publishedSlug ? `/community/${publishedSlug}` : "";
  const communityUrl =
    publishedSlug && typeof window !== "undefined"
      ? `${window.location.origin}${communityPath}`
      : communityPath;

  async function copyUrl() {
    if (!communityUrl) return;
    try {
      await navigator.clipboard.writeText(communityUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Publish to community">
      {publishedSlug ? (
        <div className="flex flex-col gap-5">
          <p className="text-sm text-[#E8E8E6]">Published.</p>
          <div className="flex items-start gap-2">
            <code className="flex-1 font-mono bg-[#0E0E10] border border-white/[0.06] rounded-[6px] px-3 py-2 text-sm overflow-x-auto select-all">
              {communityUrl}
            </code>
            <button
              type="button"
              onClick={copyUrl}
              aria-label="Copy community URL"
              className="flex items-center gap-1.5 rounded-[4px] border border-white/[0.06] bg-[#1C1C1F] px-3 py-2 text-xs uppercase tracking-wider text-[#E8E8E6] transition-transform hover:scale-[0.98]"
            >
              {copied ? (
                <>
                  <Check size={12} weight="bold" />
                  Copied
                </>
              ) : (
                <>
                  <Copy size={12} weight="bold" />
                  Copy
                </>
              )}
            </button>
          </div>
          <a
            href={communityPath}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[#8FB8DA] hover:underline"
          >
            View on community
          </a>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[4px] border border-white/[0.06] bg-[#E8E8E6] px-4 py-2 text-xs uppercase tracking-wider text-[#0E0E10] transition-transform hover:scale-[0.98]"
            >
              Done
            </button>
          </div>
        </div>
      ) : designId === null ? (
        <div className="flex flex-col gap-5">
          <p className="text-sm text-[#E8E8E6]">
            Save the design first to publish it.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[4px] border border-white/[0.06] bg-[#1C1C1F] px-4 py-2 text-xs uppercase tracking-wider text-[#E8E8E6] transition-transform hover:scale-[0.98]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onRequestSave?.();
              }}
              className="rounded-[4px] border border-white/[0.06] bg-[#E8E8E6] px-4 py-2 text-xs uppercase tracking-wider text-[#0E0E10] transition-transform hover:scale-[0.98]"
            >
              Save & Share
            </button>
          </div>
        </div>
      ) : (
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            void onPublish();
          }}
        >
          <div className="flex flex-col gap-2">
            <label className={labelClass} htmlFor="publish-name">
              Name
            </label>
            <input
              id="publish-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className={labelClass} htmlFor="publish-author">
              Author name
            </label>
            <input
              id="publish-author"
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className={inputClass}
              placeholder="Your name or handle"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className={labelClass} htmlFor="publish-description">
                Description
              </label>
              <span className="text-[10px] text-[#8A8A86] tabular-nums">
                {description.length}/{DESCRIPTION_MAX}
              </span>
            </div>
            <textarea
              id="publish-description"
              value={description}
              onChange={(e) => {
                const v = e.target.value.slice(0, DESCRIPTION_MAX);
                setDescription(v);
              }}
              maxLength={DESCRIPTION_MAX}
              rows={3}
              className={inputClass + " resize-none"}
              placeholder="What does this statusline show?"
            />
          </div>

          {error && (
            <p className="text-xs text-[#E8A08A]" role="alert">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[4px] border border-white/[0.06] bg-[#1C1C1F] px-4 py-2 text-xs uppercase tracking-wider text-[#E8E8E6] transition-transform hover:scale-[0.98]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !author.trim() || !name.trim()}
              className="rounded-[4px] border border-white/[0.06] bg-[#E8E8E6] px-4 py-2 text-xs uppercase tracking-wider text-[#0E0E10] transition-transform hover:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Publishing..." : "Publish"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
