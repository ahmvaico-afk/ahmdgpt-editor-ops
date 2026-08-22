"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EyeLogo } from "@/components/eye-logo";
import { ATTENTION_WORD } from "@/lib/screening";
import { HOURS_BANDS } from "@/lib/validation";

type Answers = {
  name: string;
  whatsapp: string;
  city: string;
  hasAiAdsExperience: boolean | null;
  portfolio: string;
  software: string;
  aiTools: string;
  ownsComputer: boolean | null;
  computerSpecs: string;
  ownsPhone: boolean | null;
  hoursPerDay: (typeof HOURS_BANDS)[number] | "";
  handlesFeedback: boolean | null;
  turnaround: string;
  whyYou: string;
  attentionAnswer: string;
};

const EMPTY: Answers = {
  name: "",
  whatsapp: "",
  city: "",
  hasAiAdsExperience: null,
  portfolio: "",
  software: "",
  aiTools: "",
  ownsComputer: null,
  computerSpecs: "",
  ownsPhone: null,
  hoursPerDay: "",
  handlesFeedback: null,
  turnaround: "",
  whyYou: "",
  attentionAnswer: "",
};

const HOURS_LABELS: Record<(typeof HOURS_BANDS)[number], string> = {
  under5: "Under 5 hours",
  "5to8": "5 – 8 hours",
  "8to10": "8 – 10 hours",
  "10plus": "10+ hours",
};

/** Steps exist so a phone shows a few questions at a time, not a wall of them. */
const STEPS = ["You", "Experience", "Setup", "Commitment", "Last bit"] as const;

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

  // Matches the CRT animation length in globals.css.
  useEffect(() => {
    const t = setTimeout(() => setBooted(true), 1600);
    return () => clearTimeout(t);
  }, []);

  function set<K extends keyof Answers>(key: K, value: Answers[K]) {
    setA((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }

  /** Each step blocks until its required answers are in. */
  const canAdvance = useMemo(() => {
    switch (step) {
      case 0:
        return a.name.trim().length >= 2 && a.whatsapp.trim().length >= 7;
      case 1:
        return (
          a.hasAiAdsExperience !== null &&
          a.software.trim().length >= 2 &&
          // Claiming experience without showing any is the first real filter.
          (!a.hasAiAdsExperience || a.portfolio.trim().length > 3)
        );
      case 2:
        return (
          a.ownsComputer !== null &&
          a.ownsPhone !== null &&
          (!a.ownsComputer || a.computerSpecs.trim().length > 3)
        );
      case 3:
        return a.hoursPerDay !== "" && a.handlesFeedback !== null;
      case 4:
        // Only that the check was answered — whether it's *correct* is scored
        // server-side, so nobody gets to retry until it goes green.
        return a.whyYou.trim().length >= 20 && a.attentionAnswer.trim().length > 0;
      default:
        return false;
    }
  }, [step, a]);

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
          ownsPhone: Boolean(a.ownsPhone),
          handlesFeedback: Boolean(a.handlesFeedback),
          secondsTaken: startedAt.current
            ? Math.round((Date.now() - startedAt.current) / 1000)
            : 0,
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
              AI UGC ads for brands. Paid per video, work from anywhere. Takes about two
              minutes — answer honestly, we check.
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
          <h1 className="font-display text-3xl font-extrabold text-text">You&rsquo;re in the pile</h1>
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
      <div className="flex w-full flex-col gap-6">
        {/* Progress: five thin bars, filled as you go. */}
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
            <Q label="Which city are you in?" optional>
              <TextInput value={a.city} onChange={(v) => set("city", v)} placeholder="Lahore" />
            </Q>
          </>
        )}

        {step === 1 && (
          <>
            <Q label="Have you edited AI UGC ads before?">
              <YesNo
                value={a.hasAiAdsExperience}
                onChange={(v) => set("hasAiAdsExperience", v)}
              />
            </Q>
            {a.hasAiAdsExperience && (
              <Q label="Drop links to your work" hint="Drive, YouTube, Instagram — anything we can open.">
                <TextArea
                  value={a.portfolio}
                  onChange={(v) => set("portfolio", v)}
                  placeholder="https://…"
                />
              </Q>
            )}
            {a.hasAiAdsExperience === false && (
              <Q label="Any editing work we can look at?" optional>
                <TextArea
                  value={a.portfolio}
                  onChange={(v) => set("portfolio", v)}
                  placeholder="Links to anything you've cut"
                />
              </Q>
            )}
            <Q label="What do you edit in?" hint="CapCut, Premiere, After Effects, DaVinci…">
              <TextInput
                value={a.software}
                onChange={(v) => set("software", v)}
                placeholder="Premiere Pro, CapCut"
              />
            </Q>
            <Q label="Which AI tools have you used?" optional hint="Veo, HeyGen, ElevenLabs, Midjourney…">
              <TextInput value={a.aiTools} onChange={(v) => set("aiTools", v)} placeholder="Veo 3, ElevenLabs" />
            </Q>
          </>
        )}

        {step === 2 && (
          <>
            <Q label="Do you own a PC or laptop?">
              <YesNo value={a.ownsComputer} onChange={(v) => set("ownsComputer", v)} />
            </Q>
            {a.ownsComputer && (
              <Q label="What are the specs?" hint="Processor, RAM, graphics card. Rough is fine.">
                <TextArea
                  value={a.computerSpecs}
                  onChange={(v) => set("computerSpecs", v)}
                  placeholder="i5 11th gen, 16GB RAM, GTX 1650"
                />
              </Q>
            )}
            {a.ownsComputer === false && (
              <p className="rounded-lg border border-warning/40 bg-warning/5 p-3 text-xs leading-relaxed text-warning">
                Heads up — most of our work needs a computer. You can still apply, but be
                honest about what you can deliver on a phone.
              </p>
            )}
            <Q label="Do you have a phone you can edit on?">
              <YesNo value={a.ownsPhone} onChange={(v) => set("ownsPhone", v)} />
            </Q>
          </>
        )}

        {step === 3 && (
          <>
            <Q label="How many hours a day can you actually give this?">
              <div className="flex flex-col gap-2">
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
            <Q
              label="Can you take feedback and redo work without getting weird about it?"
              hint="Revisions are part of the job. We'd rather know now."
            >
              <YesNo value={a.handlesFeedback} onChange={(v) => set("handlesFeedback", v)} />
            </Q>
            <Q label="How long would a 60-second AI UGC ad take you?" optional>
              <TextInput
                value={a.turnaround}
                onChange={(v) => set("turnaround", v)}
                placeholder="e.g. 3 hours"
              />
            </Q>
          </>
        )}

        {step === 4 && (
          <>
            <Q
              label="Why should we pick you?"
              hint="A few honest sentences. This is the part we actually read."
            >
              <TextArea
                value={a.whyYou}
                onChange={(v) => set("whyYou", v)}
                placeholder="Tell us something real."
                rows={4}
              />
              <p className="mt-1 text-right font-mono text-[10px] text-muted-2">
                {a.whyYou.trim().length} / 20 min
              </p>
            </Q>
            <Q label={`Last one — type the word "${ATTENTION_WORD}" below`} hint="Just checking you read this far.">
              <TextInput
                value={a.attentionAnswer}
                onChange={(v) => set("attentionAnswer", v)}
                placeholder="Your answer"
              />
            </Q>
          </>
        )}

        {error && <p className="text-sm text-accent">{error}</p>}

        <div className="mt-2 flex gap-2">
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="rounded-full border border-border px-5 py-3.5 font-mono text-xs uppercase tracking-widest text-muted transition-colors hover:text-text"
            >
              Back
            </button>
          )}
          <button
            disabled={!canAdvance || busy}
            onClick={() => (step === STEPS.length - 1 ? submit() : setStep((s) => s + 1))}
            className="flex-1 rounded-full bg-accent px-6 py-3.5 font-mono text-xs uppercase tracking-widest text-bg transition-colors hover:bg-accent-light disabled:opacity-30"
          >
            {busy ? "Sending…" : step === STEPS.length - 1 ? "Send application" : "Next"}
          </button>
        </div>
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------- pieces -- */

/** The screen: black surround, scanlines, and the CRT open on first paint. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-bg px-5 py-10">
      <div className="bg-accent-glow pointer-events-none absolute inset-0 opacity-60" />
      <div className="tv-line absolute left-1/2 top-1/2 h-px w-4/5 -translate-x-1/2 bg-text" />
      <div className="tv-open relative z-10 w-full max-w-md">{children}</div>
      <div className="tv-scanlines absolute inset-0 z-20" />
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
      className={`w-full rounded-xl border px-4 py-3.5 text-left text-sm transition-colors ${
        selected
          ? "border-accent bg-accent/10 text-text"
          : "border-border bg-surface-2 text-muted hover:text-text"
      }`}
    >
      {label}
    </button>
  );
}
