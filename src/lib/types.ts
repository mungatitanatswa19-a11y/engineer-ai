export type Paper = {
  id: string;
  uploader_id: string;
  title: string;
  description: string | null;
  subject: string | null;
  course: string | null;
  institution: string | null;
  level: string | null;
  year: number | null;
  exam_type: string | null;
  file_path: string;
  file_type: string;
  file_size: number;
  status: "private" | "pending" | "published" | "removed";
  download_count: number;
  report_count: number;
  created_at: string;
  published_at: string | null;
};

export type ChatMessage = { role: "user" | "assistant"; content: string };

// Add new engineering courses/subjects here; they flow into filters and upload forms automatically.
export const SUBJECTS = [
  "Diesel Engines",
  "Fuel Injection Systems",
  "Cooling & Lubrication",
  "Clutches & Torque Converters",
  "Gearboxes & Transmissions",
  "Propeller Shafts, Differentials & Axles",
  "Steering & Suspension",
  "Braking Systems",
  "Automotive Electrical Systems",
  "Hydraulics & Pneumatics",
  "Workshop Tools & Equipment",
  "Measurements, Tolerances & Fits",
  "Maintenance & Fault Diagnosis",
  "Engineering Drawing",
  "Workshop Safety",
  "Engineering Mathematics & Science",
];

export const COURSES = ["Diesel Plant Fitting (DPF)", "Motor Vehicle Mechanics", "General Engineering", "Other"];
export const LEVELS = ["Certificate", "National Certificate", "Diploma", "Higher Diploma", "Degree", "Other"];
export const EXAM_TYPES = ["Final Exam", "Mid-term / Test", "Assignment", "Practical", "Past Paper", "Study Notes", "Other"];

export const FILE_LABEL: Record<string, string> = {
  "application/pdf": "PDF",
  "image/png": "PNG",
  "image/jpeg": "JPG",
  "image/webp": "WEBP",
  "text/plain": "TXT",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
};
