"use client";

import { Button } from "@/components/ui/button";

// Curated request suggestions, not official programs or persisted catalog records.
const services = [
  { title: "Road expansion or intersection improvement", level: "State / local", description: "Request a review of traffic, access, safety, or capacity needs.", details: "Road/location, traffic concern, proposed improvement, and desired date." },
  { title: "Mobile OMV licensing and ID service day", level: "State", description: "Ask about bringing licensing and ID services to your community or worksite.", details: "Event location, preferred dates, estimated attendance, and services needed. Do not include license numbers or identity documents." },
  { title: "Water testing assistance", level: "State / local", description: "Request guidance on drinking water, private wells, or environmental sampling.", details: "Water source, site location, concern, and preferred contact. Do not submit sensitive health information." },
  { title: "Multi-agency pre-application meeting", level: "Multi-agency", description: "Bring the right reviewers together before preparing applications.", details: "Project scope, location, known permits, questions, and proposed meeting dates." },
  { title: "Coordinated inspection day", level: "Innovative service concept", description: "Ask whether multiple site inspections can be coordinated into one visit.", details: "Site, inspection types, readiness date, and site contact." },
  { title: "Workforce and mobile training event", level: "State / local", description: "Explore training and recruitment support for an upcoming project.", details: "Skills needed, estimated participants, location, and target dates." },
];

export function GovernmentServices({ onRequest }: { onRequest: (title: string, details: string) => void }) {
  return <section aria-label="Government services" className="space-y-4">
    <div><h2 className="text-2xl font-black text-[#00284d]">Government services</h2><p className="mt-2 text-sm text-slate-600">Demo request ideas. Availability and responsible agency must be confirmed by the project office; submitting does not book or guarantee a service.</p></div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{services.map(service => <article key={service.title} className="flex flex-col rounded-xl border border-teal-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-teal-800">{service.level} · Demo concept</p>
      <h3 className="mt-2 text-lg font-bold text-[#00284d]">{service.title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{service.description}</p>
      <p className="mb-4 mt-3 text-sm leading-6 text-slate-600"><strong>Include:</strong> {service.details}</p>
      <Button className="mt-auto bg-[#00284d]" onClick={() => onRequest(service.title, service.details)}>Request this service</Button>
    </article>)}</div>
  </section>;
}
