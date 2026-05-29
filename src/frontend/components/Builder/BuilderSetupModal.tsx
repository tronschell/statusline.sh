import Modal from "../Modal/Modal";
import { useUiStore } from "../../store/uiStore";
import SpacingSettings from "./SpacingSettings";

export interface BuilderSetupModalProps {
  isOpen: boolean;
  onClose(): void;
  /** Template id the builder was seeded from, if any. */
  templateId: string | null;
  /** Human-readable template name for the mass-change section. */
  templateName: string | null;
}

/**
 * First-run / template onboarding prompt. Wraps the shared `SpacingSettings`
 * body in the "Set up spacing between elements" framing plus a "Start
 * building" CTA, and records `builderSetupSeen` so it only auto-opens once.
 * The same spacing body is also reachable any time from Settings > Spacing.
 */
export default function BuilderSetupModal({
  isOpen,
  onClose,
  templateId,
  templateName,
}: BuilderSetupModalProps) {
  const setBuilderSetupSeen = useUiStore((s) => s.setBuilderSetupSeen);

  function handleStart() {
    setBuilderSetupSeen(true);
    onClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleStart}
      title="Set up spacing between elements"
      widthClass="max-w-xl"
      closeLabel="Start building"
    >
      <SpacingSettings
        templateId={templateId}
        templateName={templateName}
        intro={
          <p className="text-sm leading-relaxed text-[#A8A8A4]">
            As you add elements, the builder can automatically drop a little
            spacing between them so items don&apos;t run together. Pick a default
            now — you can change or remove any of it later.
          </p>
        }
      />

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={handleStart}
          className="rounded-[6px] border border-white/[0.06] bg-[#E8E8E6] px-4 py-2 text-xs uppercase tracking-wider text-[#0E0E10] transition-transform hover:scale-[0.98]"
        >
          Start building
        </button>
      </div>
    </Modal>
  );
}
