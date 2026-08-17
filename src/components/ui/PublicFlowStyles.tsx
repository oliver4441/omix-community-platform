"use client";

export function PublicFlowStyles() {
  return (
    <style>{`
      [role="main"][aria-label="Authentication"] {
        min-height: 100dvh !important;
        height: 100dvh !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
        justify-content: flex-start !important;
        padding-top: max(1rem, env(safe-area-inset-top)) !important;
        padding-bottom: max(2rem, env(safe-area-inset-bottom)) !important;
        -webkit-overflow-scrolling: touch;
      }
      [role="main"][aria-label="Authentication"] > main {
        flex: 0 0 auto;
        margin-top: auto;
        margin-bottom: auto;
      }
      @media (max-height: 760px) {
        [role="main"][aria-label="Authentication"] > main {
          margin-top: 1rem;
          margin-bottom: 1rem;
        }
      }
      @media (max-width: 480px) {
        [role="main"][aria-label="Authentication"] > main {
          border-radius: 16px;
        }
      }
    `}</style>
  );
}
