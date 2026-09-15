import { useEffect, useState } from "react";
import { recordPageView, type VisitResult } from "./visitStats";

type State = VisitResult | { status: "loading" };
const numberFormat = new Intl.NumberFormat("en-GB");
const messages = {
  loading: "Loading visit statistics…",
  ready: "Page views · Updated on this page load",
  preview: "Local preview · Visits are not recorded",
  privacy: "Statistics disabled by your privacy preference",
  unavailable: "Visit statistics temporarily unavailable",
};

export default function VisitorStats() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let active = true;
    const privacy = navigator as Navigator & { globalPrivacyControl?: boolean };
    void recordPageView(window.location.href, {
      doNotTrack: navigator.doNotTrack === "1",
      globalPrivacyControl: privacy.globalPrivacyControl === true,
    }).then((result) => {
      if (active) setState(result);
    });
    return () => { active = false; };
  }, []);

  return (
    <section className="visitor-stats" aria-label="Website visit statistics" aria-busy={state.status === "loading"}>
      <dl className="visitor-counts">
        <div>
          <dt>Total views</dt>
          <dd>{state.status === "ready" ? numberFormat.format(state.counts.total) : "—"}</dd>
        </div>
        <div>
          <dt>Views today</dt>
          <dd>{state.status === "ready" ? numberFormat.format(state.counts.today) : "—"}</dd>
        </div>
      </dl>
      <div className="visitor-info">
        <p role="status">{messages[state.status]}</p>
        <details>
          <summary>About these counts</summary>
          <p>These are recorded page views, not unique visitors. Opening or refreshing this page records one view; filtering publications and switching themes do not. Local previews are excluded.</p>
          <p>Counts begin when tracking is enabled and update on page load. “Today” resets at the statistics service’s midnight. Counts cover pages using this service on xieruihong.github.io.</p>
          <p>Statistics are provided by <a href="https://www.busuanzi.cc/" target="_blank" rel="noreferrer">Busuanzi ↗</a>. The service receives network information such as your IP address. This integration sends only the canonical page URL, omits cookies, query parameters and referring-page information, and honours Do Not Track and Global Privacy Control. Blocking the service can prevent a view from being counted.</p>
        </details>
      </div>
    </section>
  );
}
