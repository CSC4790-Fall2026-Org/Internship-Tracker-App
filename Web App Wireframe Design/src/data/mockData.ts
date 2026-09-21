// Sample data from the original wireframe. The app now reads from Supabase (see src/data/DataContext.tsx).
import type { Application } from "./types";

export type { AppStatus, InterviewStage, Contact, Application } from "./types";

export const applications: Application[] = [
  {
    id: "1",
    company: "Acme Corp",
    position: "Software Engineer Intern",
    status: "interviewing",
    appliedDate: "2026-08-10",
    deadline: "2026-09-15",
    jobUrl: "https://acmecorp.com/careers/123",
    location: "San Francisco, CA (Hybrid)",
    salary: "$42/hr",
    notes: "Referral from alumni network. Recruiter is Sarah Chen. Technical screen went well — focus on system design next round.",
    logoColor: "#3B82F6",
    logoInitials: "AC",
    interviewStages: [
      { id: "i1", name: "Recruiter Screen", date: "2026-08-18", notes: "30 min call. Discussed team, culture, timeline.", completed: true },
      { id: "i2", name: "Technical Phone Screen", date: "2026-08-26", notes: "LeetCode medium — sliding window + DP. Passed.", completed: true },
      { id: "i3", name: "Virtual Onsite", date: "2026-09-08", notes: "4 rounds: 2x coding, 1x system design, 1x behavioral.", completed: false },
    ],
    contacts: [
      { id: "c1", name: "Sarah Chen", role: "University Recruiter", company: "Acme Corp", email: "s.chen@acmecorp.com" },
      { id: "c2", name: "Marcus Webb", role: "Hiring Manager, Platform", company: "Acme Corp", email: "m.webb@acmecorp.com" },
    ],
  },
  {
    id: "2",
    company: "TechStart Inc.",
    position: "Product Design Intern",
    status: "applied",
    appliedDate: "2026-08-20",
    deadline: "2026-09-20",
    jobUrl: "https://techstart.io/jobs/design-intern",
    location: "New York, NY (On-site)",
    salary: "$38/hr",
    notes: "Applied through Handshake. Portfolio submitted. Waiting to hear back on initial screen.",
    logoColor: "#8B5CF6",
    logoInitials: "TS",
    interviewStages: [],
    contacts: [],
  },
  {
    id: "3",
    company: "Meridian Health",
    position: "Data Analyst Intern",
    status: "applied",
    appliedDate: "2026-08-22",
    deadline: "2026-09-12",
    jobUrl: "https://meridianhealth.org/careers",
    location: "Boston, MA (Remote)",
    salary: "$30/hr",
    notes: "Requires Python and SQL proficiency. Health tech experience a plus — mentioned research project in cover letter.",
    logoColor: "#10B981",
    logoInitials: "MH",
    interviewStages: [],
    contacts: [
      { id: "c3", name: "Jordan Lee", role: "Data Team Lead", company: "Meridian Health", email: "jordan.lee@meridianhealth.org" },
    ],
  },
  {
    id: "4",
    company: "Bloom Analytics",
    position: "Frontend Engineer Intern",
    status: "wishlist",
    appliedDate: "",
    deadline: "2026-10-01",
    jobUrl: "https://bloomanalytics.com/jobs/frontend",
    location: "Austin, TX (Hybrid)",
    salary: "$44/hr",
    notes: "Strong React + TypeScript focus. Found on LinkedIn. Need to tailor resume before applying.",
    logoColor: "#F59E0B",
    logoInitials: "BA",
    interviewStages: [],
    contacts: [],
  },
  {
    id: "5",
    company: "Nexus Systems",
    position: "Backend Developer Intern",
    status: "rejected",
    appliedDate: "2026-07-30",
    deadline: "2026-08-25",
    jobUrl: "https://nexussystems.com/careers",
    location: "Seattle, WA (On-site)",
    salary: "$40/hr",
    notes: "Rejection received after final round. Ask for feedback from recruiter. Good practice for system design questions.",
    logoColor: "#EF4444",
    logoInitials: "NS",
    interviewStages: [
      { id: "i4", name: "Recruiter Screen", date: "2026-08-05", notes: "Went well.", completed: true },
      { id: "i5", name: "Technical Interview", date: "2026-08-14", notes: "Database design and concurrency.", completed: true },
    ],
    contacts: [
      { id: "c4", name: "Priya Nair", role: "Talent Acquisition", company: "Nexus Systems", email: "priya@nexussystems.com" },
    ],
  },
  {
    id: "6",
    company: "ClearPath Labs",
    position: "ML Engineer Intern",
    status: "offer",
    appliedDate: "2026-07-15",
    deadline: "2026-08-01",
    jobUrl: "https://clearpathabs.ai/jobs",
    location: "Remote",
    salary: "$52/hr",
    notes: "Offer received! Deadline to accept: Sept 10. Compare with Acme outcome before deciding.",
    logoColor: "#06B6D4",
    logoInitials: "CL",
    interviewStages: [
      { id: "i6", name: "Intro Call", date: "2026-07-20", notes: "Culture fit + research interests.", completed: true },
      { id: "i7", name: "ML Coding Assessment", date: "2026-07-28", notes: "PyTorch model fine-tuning task.", completed: true },
      { id: "i8", name: "Final Interview", date: "2026-08-05", notes: "Research presentation + Q&A.", completed: true },
    ],
    contacts: [
      { id: "c5", name: "Alex Rivera", role: "Research Lead", company: "ClearPath Labs", email: "alex.r@clearpathabs.ai" },
    ],
  },
  {
    id: "7",
    company: "Vertex Capital",
    position: "Quantitative Analyst Intern",
    status: "wishlist",
    appliedDate: "",
    deadline: "2026-10-15",
    jobUrl: "https://vertexcap.com/internships",
    location: "Chicago, IL (On-site)",
    salary: "$60/hr",
    notes: "Very competitive. Need to prep probability/stats heavily. Reach out to alumni at the firm first.",
    logoColor: "#6366F1",
    logoInitials: "VC",
    interviewStages: [],
    contacts: [],
  },
];

export const tasks = [
  { id: "t1", text: "Send thank-you email to Marcus Webb (Acme Corp)", done: false, company: "Acme Corp", due: "2026-09-05" },
  { id: "t2", text: "Prepare system design answers for Acme onsite", done: false, company: "Acme Corp", due: "2026-09-07" },
  { id: "t3", text: "Email ClearPath Labs — request offer letter details", done: true, company: "ClearPath Labs", due: "2026-09-02" },
  { id: "t4", text: "Tailor resume for Bloom Analytics before applying", done: false, company: "Bloom Analytics", due: "2026-09-10" },
  { id: "t5", text: "Request feedback from Nexus Systems recruiter", done: false, company: "Nexus Systems", due: "2026-09-06" },
];

export const recentActivity = [
  { id: "a1", type: "status", text: "ClearPath Labs moved to Offer", time: "2 hours ago", icon: "offer" },
  { id: "a2", type: "added", text: "Added Meridian Health – Data Analyst Intern", time: "Yesterday", icon: "added" },
  { id: "a3", type: "interview", text: "Acme Corp virtual onsite scheduled for Sept 8", time: "Yesterday", icon: "interview" },
  { id: "a4", type: "status", text: "Nexus Systems moved to Rejected", time: "3 days ago", icon: "rejected" },
  { id: "a5", type: "added", text: "Added TechStart Inc. – Product Design Intern", time: "4 days ago", icon: "added" },
];

export const upcomingDeadlines = [
  { id: "d1", company: "Meridian Health", position: "Data Analyst Intern", deadline: "2026-09-12", daysLeft: 8 },
  { id: "d2", company: "Acme Corp", position: "Software Engineer Intern", deadline: "2026-09-15", daysLeft: 11 },
  { id: "d3", company: "TechStart Inc.", position: "Product Design Intern", deadline: "2026-09-20", daysLeft: 16 },
  { id: "d4", company: "Bloom Analytics", position: "Frontend Engineer Intern", deadline: "2026-10-01", daysLeft: 27 },
  { id: "d5", company: "Vertex Capital", position: "Quantitative Analyst Intern", deadline: "2026-10-15", daysLeft: 41 },
];

export const upcomingInterviews = [
  { id: "iv1", company: "Acme Corp", stage: "Virtual Onsite", date: "2026-09-08", time: "10:00 AM PST" },
];
