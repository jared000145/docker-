import MarketingContentPage from "@/components/marketing/MarketingContentPage";

const SchoolManagementSystemPage = () => (
  <MarketingContentPage
    path="/school-management-system"
    title="School Management System for Schools & Universities | RectorPlus"
    description="RectorPlus is a modern cloud school management system and student management system: grading, report cards, timetables, fees, attendance, parent portal and video classes. Built for Africa and Europe."
    eyebrow="For international institutions"
    h1="A modern school management system for schools and universities"
    intro="RectorPlus is a cloud-based school management system and student management system that unifies enrolment, grading, timetabling, fees, attendance and communication in one secure platform — for primary schools, secondary schools, colleges and universities across Africa and Europe."
    sections={[
      {
        h2: "What a school management system should do",
        paragraphs: [
          "A school management system is the operational backbone of an institution. It holds the authoritative record of every student, every grade, every payment and every schedule change, and it makes that record available to the right person at the right moment — without spreadsheets circulating by email.",
          "RectorPlus covers the full administrative lifecycle: enrolment and student files, academic structure, assessment and report cards, attendance, fee collection, internal messaging, notifications, digital library and online classes. Each role — administrator, director, teacher, parent, student — sees a tailored interface.",
        ],
        bullets: [
          "Student records with guardians, documents and full history",
          "Automated grading, averages, rankings and report cards",
          "Weekly timetables with room allocation and conflict detection",
          "Tuition fees, instalments and numbered receipts",
          "Attendance and lateness recorded in class",
          "Parent portal with grades, absences and payments",
        ],
      },
      {
        h2: "One platform, every education cycle",
        paragraphs: [
          "Most products serve either K-12 or higher education. RectorPlus supports both. When an institution is created, its cycle is selected — primary, middle school, high school, BTS or LMD university — and the platform activates only the relevant modules and vocabulary.",
          "Secondary schools work with trimesters, coefficients, series and class rankings. Universities work with semesters, teaching units, ECTS credits, compensation rules and resit sessions. Both models are first-class citizens, not configuration workarounds.",
        ],
      },
      {
        h2: "Security and multi-tenant data isolation",
        paragraphs: [
          "Every institution operates in a strictly isolated tenant. Isolation is enforced at database level through row-level security, so no query can cross the boundary between two institutions. Sensitive deletions are written to an audit log, and administrators can export restorable backups.",
          "Role-based access control covers super administrators, directors, administrative staff with per-module permissions, teachers restricted to their own classes, parents restricted to their children, and students restricted to their own records.",
        ],
        subsections: [
          {
            h3: "Verifiable documents",
            text: "Report cards, transcripts, receipts and certificates carry a QR code that opens a public verification page, confirming authenticity and displaying the underlying data.",
          },
          {
            h3: "Branded portal per institution",
            text: "Each school receives a dedicated subdomain with its own logo, colours and login page. Users can only sign in through their own institution's portal.",
          },
        ],
      },
      {
        h2: "Built for real-world connectivity",
        paragraphs: [
          "A student management system is only useful if staff can actually use it. RectorPlus runs in the browser, requires no server installation, and is optimised for mid-range smartphones and modest bandwidth — a decisive factor for institutions operating outside major urban centres.",
          "Teachers can record attendance and grades from a phone between classes. Parents receive notifications without needing to install anything.",
        ],
      },
      {
        h2: "Implementation and migration",
        paragraphs: [
          "Onboarding starts with a pre-registration form and supporting documents. Once our team validates the file, the institution receives its administrator credentials and its branded portal. Existing student data can be imported in bulk from Excel, including historical grades and payments.",
          "Deployment is progressive: academic records first, then finance, then communication and enrichment modules. Each stage delivers a measurable result within a single term.",
        ],
      },
      {
        h2: "Pricing and support",
        paragraphs: [
          "Plans start at 150,000 XAF per month for smaller institutions, with a Pro plan for unlimited enrolment and an Enterprise plan for school groups and multi-campus universities requiring dedicated domains, SSO and advanced backups.",
          "Support is available by email and WhatsApp, with priority response on Pro and Enterprise plans.",
        ],
      },
    ]}
    faq={[
      { q: "Is RectorPlus a cloud or on-premise system?", a: "It is a cloud platform accessible from any browser. There is no server to install or maintain." },
      { q: "Can it handle both a high school and a university?", a: "Yes. Each institution selects its cycle, and the platform adapts modules, terminology and grading rules accordingly." },
      { q: "Do parents get their own access?", a: "Yes, parents have a dedicated portal showing grades, attendance, timetables and payments for their children." },
      { q: "Is the interface available in English?", a: "The platform is primarily French, with English-language documentation and support for international institutions. Contact us for language requirements." },
      { q: "How is our data protected?", a: "Database-level tenant isolation, role-based permissions, audit logging on sensitive actions and exportable backups." },
    ]}
    ctaTitle="Book a demo of RectorPlus"
    ctaText="We will configure a sample class, your grading rules and a real report card so you can evaluate the system with your own data."
  />
);

export default SchoolManagementSystemPage;
