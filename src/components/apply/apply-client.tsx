"use client";

import { useEffect, useRef, useState } from "react";
import { EyeLogo } from "@/components/eye-logo";
import {
  ATTENTION_WORD,
  SOURCE_OPTIONS,
  sourceDetailLabel,
  sourceDetailPlaceholder,
} from "@/lib/screening";
import { HOURS_BANDS } from "@/lib/validation";

type Answers = {
  name: string;
  whatsapp: string;
  source: string;
  sourceDetail: string;
  hasAiAdsExperience: boolean | null;
  portfolio: string;
  software: string;
  ownsComputer: boolean | null;
  computerSpecs: string;
  hoursPerDay: (typeof HOURS_BANDS)[number] | "";
  whyYou: string;
  attentionAnswer: string;
};

const EMPTY: Answers = {
  name: "",
  whatsapp: "",
  source: "",
  sourceDetail: "",
  hasAiAdsExperience: null,
  portfolio: "",
  software: "",
  ownsComputer: null,
  computerSpecs: "",
  hoursPerDay: "",
  whyYou: "",
  attentionAnswer: "",
};

const HOURS_LABELS: Record<(typeof HOURS_BANDS)[number], string> = {
  under5: "Under 5 hours",
  "5to8": "5 – 8 hours",
  "8to10": "8 – 10 hours",
  "10plus": "10+ hours",
};

/**
 * Three short screens. Every question here earns its place — anything we can
 * find out later in a WhatsApp message isn't worth losing an applicant over.
 */
const STEPS = ["You", "Your work", "Setup"] as const;

/**
 * What's still missing on this step, in plain words. Returning the sentence
 * rather than a boolean is the point: a dead grey button tells an applicant
 * nothing, and they leave thinking the page is broken.
 */
function missingOn(step: number, a: Answers): string | null {
  switch (step) {
    case 0:
      if (a.name.trim().length < 2) return "Add your name first.";
      if (a.whatsapp.trim().length < 7) return "We need a WhatsApp number to reach you on.";
      if (a.source === "") return "Tap where you saw this.";
      return null;
    case 1:
      if (a.hasAiAdsExperience === null) return "Yes or no on the AI ads question.";
      if (a.software.trim().length < 2) return "Tell us what you edit in.";
      return null;
    case 2:
      if (a.ownsComputer === null) return "Yes or no on the computer question.";
      if (a.hoursPerDay === "") return "Pick how many hours a day you can give.";
      if (a.attentionAnswer.trim().length === 0)
        return "Last box — type the word and you're done.";
      return null;
    default:
      return null;
  }
}

export function ApplyClient() {
  const [booted, setBooted] = useState(false);
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [a, setA] = useState<Answers>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  /** Set when they hit Start, so we know how long the form actually took. */
  const startedAt = useRef<number | null>(null);

  /**
   * `?from=` on the link, so a per-channel URL tags itself. Read once on mount
   * rather than at submit, in case the applicant navigates within the page.
   */
  const sourceTag = useRef<string>("");
  useEffect(() => {
    const tag = new URLSearchParams(window.location.search).get("from");
    if (tag) sourceTag.current = tag.slice(0, 60);
  }, []);

  // Matches the CRT animation length in globals.css.
  useEffect(() => {
    const t = setTimeout(() => setBooted(true), 1600);
    return () => clearTimeout(t);
  }, []);

  function set<K extends keyof Answers>(key: K, value: Answers[K]) {
    setA((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }

  function next() {
    const missing = missingOn(step, a);
    if (missing) {
      setError(missing);
      return;
    }
    if (step === STEPS.length - 1) {
      void submit();
      return;
    }
    setStep((s) => s + 1);
    // A new screen starts at the top, or the next step opens half-read.
    window.scrollTo({ top: 0 });
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...a,
          hasAiAdsExperience: Boolean(a.hasAiAdsExperience),
          ownsComputer: Boolean(a.ownsComputer),
          secondsTaken: startedAt.current
            ? Math.round((Date.now() - startedAt.current) / 1000)
            : 0,
          sourceTag: sourceTag.current || undefined,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "Could not send. Try again.");
        return;
      }
      setDone(true);
    } catch {
      setError("Could not send. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  /* ------------------------------------------------------------- screens -- */

  if (!started) {
    return (
      <Shell>
        <div className={booted ? "tv-on" : ""}>
          <div className="flex flex-col items-center gap-5 text-center">
            <EyeLogo className="h-12 w-12 text-accent" />
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">
                Now casting
              </p>
              <h1 className="mt-2 font-display text-4xl font-extrabold leading-[1.05] text-text sm:text-5xl">
                We&rsquo;re hiring
                <br />
                video editors
              </h1>
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-muted">
              AI UGC ads for brands. Paid per video, work from anywhere. Nine quick
              questions — about a minute.
            </p>
            <button
              onClick={() => {
                startedAt.current = Date.now();
                setStarted(true);
              }}
              className="mt-2 w-full max-w-xs rounded-full bg-accent px-8 py-4 font-mono text-sm uppercase tracking-widest text-bg transition-colors hover:bg-accent-light"
            >
              Start
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-5 text-center">
          <EyeLogo className="h-12 w-12 text-green" />
          <h1 className="font-display text-3xl font-extrabold text-text">
            You&rsquo;re in the pile
          </h1>
          <p className="max-w-xs text-sm leading-relaxed text-muted">
            We read every one. If your work fits, you&rsquo;ll get a WhatsApp from us — no
            need to follow up.
          </p>
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-2">
            AHMD.GPT
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* Progress: thin bars, filled as you go. */}
      <div className="flex items-center gap-1.5">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= step ? "bg-accent" : "bg-surface-2"
            }`}
          />
        ))}
      </div>
      <p className="-mt-3 font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
        {step + 1} / {STEPS.length} · {STEPS[step]}
      </p>

      {step === 0 && (
        <>
          <Q label="What's your name?">
            <TextInput value={a.name} onChange={(v) => set("name", v)} placeholder="Full name" />
          </Q>
          <Q label="WhatsApp number" hint="With country code — this is how we reach you.">
            <TextInput
              value={a.whatsapp}
              onChange={(v) => set("whatsapp", v)}
              placeholder="+92 300 1234567"
              inputMode="tel"
            />
          </Q>
          <Q label="Where did you see this?">
            {/* Two columns: six full-width rows pushed the button off a phone
                screen, which is how this got reported as a broken page. */}
            <div className="grid grid-cols-2 gap-2">
              {SOURCE_OPTIONS.map((o) => (
                <Choice
                  key={o.value}
                  label={o.label}
                  selected={a.source === o.value}
                  onClick={() => set("source", o.value)}
                />
              ))}
            </div>
          </Q>
          {a.source !== "" && (
            <Q label={sourceDetailLabel(a.source)} optional>
              <TextInput
                value={a.sourceDetail}
                onChange={(v) => set("sourceDetail", v)}
                placeholder={sourceDetailPlaceholder(a.source)}
              />
            </Q>
          )}
        </>
      )}

      {step === 1 && (
        <>
          <Q label="Have you edited AI UGC ads before?">
            <YesNo value={a.hasAiAdsExperience} onChange={(v) => set("hasAiAdsExperience", v)} />
          </Q>
          <Q
            label={
              a.hasAiAdsExperience ? "Drop links to your work" : "Any editing work we can look at?"
            }
            hint="Drive, YouTube, Instagram — anything we can open."
            optional
          >
            <TextArea
              value={a.portfolio}
              onChange={(v) => set("portfolio", v)}
              placeholder="https://…"
            />
          </Q>
          <Q label="What do you edit in?" hint="CapCut, Premiere, After Effects, DaVinci…">
            <TextInput
              value={a.software}
              onChange={(v) => set("software", v)}
              placeholder="Premiere Pro, CapCut"
            />
          </Q>
        </>
      )}

      {step === 2 && (
        <>
          <Q label="Do you own a PC or laptop?">
            <YesNo value={a.ownsComputer} onChange={(v) => set("ownsComputer", v)} />
          </Q>
          {a.ownsComputer && (
            <Q label="What are the specs?" hint="Rough is fine." optional>
              <TextInput
                value={a.computerSpecs}
                onChange={(v) => set("computerSpecs", v)}
                placeholder="i5 11th gen, 16GB RAM, GTX 1650"
              />
            </Q>
          )}
          <Q label="Hours a day you can give this?">
            <div className="grid grid-cols-2 gap-2">
              {HOURS_BANDS.map((band) => (
                <Choice
                  key={band}
                  label={HOURS_LABELS[band]}
                  selected={a.hoursPerDay === band}
                  onClick={() => set("hoursPerDay", band)}
                />
              ))}
            </div>
          </Q>
          <Q label="Why should we pick you?" hint="A couple of honest lines." optional>
            <TextArea
              value={a.whyYou}
              onChange={(v) => set("whyYou", v)}
              placeholder="Tell us something real."
              rows={3}
            />
          </Q>
          <Q label={`Type the word "${ATTENTION_WORD}"`} hint="Just checking you read this far.">
            <TextInput
              value={a.attentionAnswer}
              onChange={(v) => set("attentionAnswer", v)}
              placeholder={ATTENTION_WORD}
            />
          </Q>
        </>
      )}

      {error && (
        <p className="rounded-lg border border-accent/40 bg-accent/10 p-3 text-sm text-accent">
          {error}
        </p>
      )}

      <div className="mt-2 flex gap-2">
        {step > 0 && (
          <button
            onClick={() => {
              setError(null);
              setStep((s) => s - 1);
            }}
            className="rounded-full border border-border px-5 py-3.5 font-mono text-xs uppercase tracking-widest text-muted transition-colors hover:text-text"
          >
            Back
          </button>
        )}
        {/* Never disabled: tapping it with something missing says what's
            missing. A button that does nothing reads as a broken page. */}
        <button
          disabled={busy}
          onClick={next}
          className="flex-1 rounded-full bg-accent px-6 py-3.5 font-mono text-xs uppercase tracking-widest text-bg transition-colors hover:bg-accent-light disabled:opacity-40"
        >
          {busy ? "Sending…" : step === STEPS.length - 1 ? "Send application" : "Next"}
        </button>
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------- pieces -- */

/**
 * The screen: black surround, scanlines, and the CRT open on first paint.
 *
 * The decoration is `fixed`, not `absolute` inside an `overflow-hidden` box.
 * That wrapper clipped any step taller than the viewport, and with flex
 * centring there was no way to scroll to the rest — on a phone the Next button
 * simply wasn't reachable. `m-auto` centres short screens without trapping
 * tall ones.
 */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-[100dvh] bg-bg">
      <div className="bg-accent-glow pointer-events-none fixed inset-0 opacity-60" />
      <div className="tv-line pointer-events-none fixed left-1/2 top-1/2 h-px w-4/5 -translate-x-1/2 bg-text" />
      <div className="tv-scanlines pointer-events-none fixed inset-0 z-20" />
      <div className="relative z-10 flex min-h-[100dvh] flex-col px-5 py-10">
        <div className="tv-open m-auto flex w-full max-w-md flex-col gap-6">{children}</div>
      </div>
    </div>
  );
}

function Q({
  label,
  hint,
  optional,
  children,
}: {
  label: string;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-[15px] font-medium leading-snug text-text">
          {label}
          {optional && (
            <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-muted-2">
              optional
            </span>
          )}
        </p>
        {hint && <p className="mt-0.5 text-xs leading-relaxed text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

const FIELD =
  "w-full rounded-xl border border-border bg-surface-2 px-4 py-3.5 text-base text-text outline-none transition-colors placeholder:text-muted-2 focus:border-accent";

function TextInput({
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "tel" | "text";
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      inputMode={inputMode}
      className={FIELD}
    />
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={`${FIELD} resize-none`}
    />
  );
}

function YesNo({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex gap-2">
      {[
        { v: true, label: "Yes" },
        { v: false, label: "No" },
      ].map((o) => (
        <button
          key={o.label}
          onClick={() => onChange(o.v)}
          className={`flex-1 rounded-xl border px-4 py-3.5 font-mono text-xs uppercase tracking-widest transition-colors ${
            value === o.v
              ? "border-accent bg-accent text-bg"
              : "border-border bg-surface-2 text-muted hover:text-text"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Choice({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-xl border px-3 py-3.5 text-center text-sm transition-colors ${
        selected
          ? "border-accent bg-accent/10 text-text"
          : "border-border bg-surface-2 text-muted hover:text-text"
      }`}
    >
      {label}
    </button>
  );
}
