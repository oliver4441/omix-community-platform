"use client";

import { Mso } from "@/components/ui/icons";
import type { AppView } from "@/lib/views";

const DISCOVERY = [
  { title: "Local", description: "Discover community stories and local interests.", icon: "location_on" },
  { title: "Business", description: "Entrepreneurship, careers and opportunities.", icon: "business_center" },
  { title: "Entertainment", description: "Media, culture, music and things to watch.", icon: "play_circle" },
  { title: "Education", description: "Learning, study and useful resources.", icon: "school" },
  { title: "Technology", description: "Accessible technology conversations without the developer jargon.", icon: "devices" },
  { title: "Sports", description: "Sports communities, discussions and events.", icon: "sports_soccer" },
];

export function CommunityHome({ onNavigate }: { onNavigate: (view: AppView) => void }) {
  return (
    <main className="h-full w-full overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
        <header className="mb-7 rounded-2xl border border-outline-variant bg-surface-container-low p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Mso name="public" size={15} /> Community Mode
              </span>
              <h1 className="mt-4 text-2xl font-bold tracking-tight text-on-surface sm:text-3xl">
                Your community, your interests.
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant sm:text-base">
                Discover conversations, local interests, media and communities. Developer Mode
                remains one tap away from your account menu.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("boards")}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-outline-variant bg-surface-container px-4 text-sm font-medium text-on-surface hover:border-primary/50"
            >
              <Mso name="forum" size={18} />
              Explore forums
            </button>
          </div>
        </header>

        <section aria-labelledby="discover-title">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 id="discover-title" className="text-lg font-semibold text-on-surface">Discover</h2>
              <p className="text-sm text-on-surface-variant">Choose a topic to shape your community feed.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {DISCOVERY.map((item) => (
              <button
                key={item.title}
                type="button"
                className="group rounded-2xl border border-outline-variant bg-surface-container-low p-5 text-left transition-colors hover:border-primary/40 hover:bg-surface-container"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-on-primary">
                  <Mso name={item.icon} size={21} />
                </span>
                <h3 className="mt-4 font-semibold text-on-surface">{item.title}</h3>
                <p className="mt-1 text-sm leading-5 text-on-surface-variant">{item.description}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-7 grid grid-cols-1 gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => onNavigate("dms")}
            className="rounded-2xl border border-outline-variant bg-surface-container-low p-5 text-left hover:border-primary/40"
          >
            <Mso name="chat" size={21} className="text-primary" />
            <h2 className="mt-3 font-semibold text-on-surface">Messages</h2>
            <p className="mt-1 text-sm text-on-surface-variant">Continue private conversations with people in your community.</p>
          </button>
          <button
            type="button"
            onClick={() => onNavigate("boards")}
            className="rounded-2xl border border-outline-variant bg-surface-container-low p-5 text-left hover:border-primary/40"
          >
            <Mso name="groups" size={21} className="text-primary" />
            <h2 className="mt-3 font-semibold text-on-surface">Communities</h2>
            <p className="mt-1 text-sm text-on-surface-variant">Join discussions around the things you care about.</p>
          </button>
        </section>
      </div>
    </main>
  );
}
