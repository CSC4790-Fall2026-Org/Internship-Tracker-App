export type AppStatus = "wishlist" | "applied" | "interviewing" | "offer" | "rejected";

export interface InterviewStage {
  id: string;
  name: string;
  date: string;
  notes: string;
  completed: boolean;
}

export interface Contact {
  id: string;
  name: string;
  role: string;
  company: string;
  email: string;
}

export interface Application {
  id: string;
  company: string;
  position: string;
  status: AppStatus;
  appliedDate: string;
  deadline: string;
  jobUrl: string;
  location: string;
  salary: string;
  notes: string;
  logoColor: string;
  logoInitials: string;
  interviewStages: InterviewStage[];
  contacts: Contact[];
}

export interface Task {
  id: string;
  text: string;
  done: boolean;
  due: string;
  applicationId: string | null;
  company: string;
}
