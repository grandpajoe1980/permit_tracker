const capabilities = [
  {
    title: "One place to track progress",
    description:
      "See your requests, responsible organization, current stage, and next action from a single secure dashboard.",
  },
  {
    title: "Clear schedules and milestones",
    description:
      "Understand planned dates, required processing periods, dependencies, and changes that can affect delivery.",
  },
  {
    title: "Coordinated agency work",
    description:
      "Authorized teams can route work, manage dependencies, and coordinate participating organizations with an auditable history.",
  },
];

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="PATH home">
          <span className="brand-mark" aria-hidden="true">P</span>
          <span>
            <strong>PATH</strong>
            <small>Project &amp; Permit Tracking</small>
          </span>
        </a>
        <a className="button button-secondary" href="/login">Sign in</a>
      </header>

      <section className="hero" id="top">
        <div className="hero-content">
          <p className="eyebrow">Louisiana project coordination</p>
          <h1>A clearer path through permits and approvals.</h1>
          <p className="hero-copy">
            PATH connects customers and participating government organizations
            around requests, schedules, documents, and next actions.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="/login">Track a request</a>
            <a className="text-link" href="#capabilities">
              Learn how PATH works <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
        <aside className="status-preview" aria-label="Example request status">
          <div className="preview-header">
            <span>Request status</span>
            <strong>In review</strong>
          </div>
          <p className="case-number">PATH-2026-00124</p>
          <h2>Water quality permit review</h2>
          <dl>
            <div>
              <dt>Lead organization</dt>
              <dd>LDEQ</dd>
            </div>
            <div>
              <dt>Next action</dt>
              <dd>Technical review</dd>
            </div>
          </dl>
          <div className="progress-track" aria-label="3 of 5 stages complete">
            <span />
          </div>
          <p className="progress-label">3 of 5 stages complete</p>
        </aside>
      </section>

      <section className="capabilities" id="capabilities" aria-labelledby="capability-title">
        <div className="section-heading">
          <p className="eyebrow">Built for shared visibility</p>
          <h2 id="capability-title">Know where work stands and what happens next.</h2>
        </div>
        <div className="card-grid">
          {capabilities.map((capability, index) => (
            <article className="capability-card" key={capability.title}>
              <span className="card-number" aria-hidden="true">0{index + 1}</span>
              <h3>{capability.title}</h3>
              <p>{capability.description}</p>
            </article>
          ))}
        </div>
      </section>

      <footer>
        <span>PATH</span>
        <p>Secure project and permit coordination for participating organizations.</p>
      </footer>
    </main>
  );
}
