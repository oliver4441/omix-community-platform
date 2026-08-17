"use client";

import { useMemo, useState } from "react";
import { saveExperiencePreferences, type ExperienceMode } from "@/lib/experience";
import { Mso } from "@/components/ui/icons";

const COMMUNITY_INTERESTS = [
  "Kenya",
  "Business",
  "Entertainment",
  "Sports",
  "Education",
  "Technology",
  "Music",
  "Gaming",
  "Science",
  "Entrepreneurship",
  "News",
  "Lifestyle",
];

const DEVELOPER_INTERESTS = [
  "JavaScript",
  "TypeScript",
  "Python",
  "Java",
  "PHP",
  "Go",
  "Rust",
  "React",
  "Flutter",
  "AI / ML",
  "DevOps",
  "Cybersecurity",
];

export function ExperienceOnboarding({
  uid,
  displayName,
  onComplete,
}: {
  uid: string;
  displayName: string;
  onComplete: () => void;
}) {
  const [mode, setMode] = useState<ExperienceMode>("community");
  const [communityInterests, setCommunityInterests] = useState<string[]>([]);
  const [developerInterests, setDeveloperInterests] = useState<string[]>([]);

  const interestOptions = useMemo(() => {
    if (mode === "developer") return { title: "What do you build with?", items: DEVELOPER_INTERESTS };
    if (mode === "both") return { title: "Choose your interests", items: [...COMMUNITY_INTERESTS, ...DEVELOPER_INTERESTS] };
    return { title: "What are you interested in?", items: COMMUNITY_INTERESTS };
  }, [mode]);

  const toggleInterest = (interest: string) => {
    const isDev = DEVELOPER_INTERESTS.includes(interest);
    const setter = isDev ? setDeveloperInterests : setCommunityInterests;
    setter((current) =>
      current.includes(interest)
        ? current.filter((item) => item !== interest)
        : [...current, interest]
    );
  };

  const finish = () => {
    saveExperiencePreferences(uid, {
      mode,
      defaultMode: mode === "developer" ? "developer" : "community",
      interests: communityInterests,
      developerInterests,
      completed: true,
    });
    onComplete();
  };

  return (
    <main className="min-h-screen w-full bg-background overflow-y-auto">
      <div className="hero-glow" aria-hidden />
      <div className="absolute inset-0 bg-grid opacity-40 pointer-events-none" aria-hidden />

      <div className="relative z-10 mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
        <header className="mb-8 sm:mb-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 overflow-hidden rounded-xl bg-surface-container-high">
              <img src="/logo.jpg" alt="Omix" className="h-full w-full object-cover" />
            </div>
            <span className="font-headline-sm text-headline-sm font-bold text-primary">Omix</span>
          </div>
          <p className="mb-2 text-sm font-medium text-primary">Welcome, {displayName}</p>
          <h1 className="font-headline-lg text-3xl font-bold tracking-tight text-on-surface sm:text-4xl">
            Choose your Omix experience
          </h1>
          <p className="mt-3 max-w-2xl text-on-surface-variant">
            One account can use both sides of Omix. We will simply choose the best starting
            experience for you. You can switch later without signing out.
          </p>
        </header>

        <section aria-labelledby="experience-options" className="space-y-6">
          <h2 id="experience-options" className="sr-only">Experience options</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ModeCard
              selected={mode === "community"}
              icon="public"
              title="Community"
              description="Local discovery, communities, media, discussions and everyday interests."
              onClick={() => setMode("community")}
            />
            <ModeCard
              selected={mode === "developer"}
              icon="code"
              title="Developer"
              description="Technical communities, developer updates, GitHub and projects."
              onClick={() => setMode("developer")}
            />
            <ModeCard
              selected={mode === "both"}
              icon="swap_horiz"
              title="Both"
              description="Use both experiences. Community is your initial default."
              onClick={() => setMode("both")}
            />
          </div>

          <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Mso name="interests" size={20} />
              </div>
              <div>
                <h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                  {interestOptions.title}
                </h2>
                <p className="text-sm text-on-surface-variant">Pick a few. You can change these later.</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {interestOptions.items.map((interest) => {
                const selected = COMMUNITY_INTERESTS.includes(interest)
                  ? communityInterests.includes(interest)
                  : developerInterests.includes(interest);
                return (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => toggleInterest(interest)}
                    aria-pressed={selected}
                    className={`rounded-full border px-3 py-2 text-sm transition-colors ${
                      selected
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-outline-variant bg-surface-container text-on-surface-variant hover:border-primary/50 hover:text-on-surface"
                    }`}
                  >
                    {interest}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-outline-variant bg-surface-container-low p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-on-surface">
                {mode === "developer" ? "Developer Mode" : "Community Mode"} will be your default.
              </p>
              <p className="mt-1 text-sm text-on-surface-variant">
                You can teleport to the other experience from your account menu at any time.
              </p>
            </div>
            <button
              type="button"
              onClick={finish}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-medium text-on-primary hover:opacity-90"
            >
              Enter Omix
              <Mso name="arrow_forward" size={18} />
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function ModeCard({
  selected,
  icon,
  title,
  description,
  onClick,
}: {
  selected: boolean;
  icon: string;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`relative min-h-44 rounded-2xl border p-5 text-left transition-all ${
        selected
          ? "border-primary bg-primary/10 ring-1 ring-primary/40"
          : "border-outline-variant bg-surface-container-low hover:border-primary/40 hover:bg-surface-container"
      }`}
    >
      <div className={`mb-5 flex h-10 w-10 items-center justify-center rounded-xl ${selected ? "bg-primary text-on-primary" : "bg-surface-container-high text-primary"}`}>
        <Mso name={icon} size={21} fill={selected} />
      </div>
      <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">{title}</h3>
      <p className="mt-2 text-sm leading-5 text-on-surface-variant">{description}</p>
      {selected && (
        <span className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-on-primary">
          <Mso name="check" size={16} />
        </span>
      )}
    </button>
  );
}
