export interface Project {
  id: string;
  title: string;
  description: string;
  budget: string;
  skills: string[];
  url: string;
  postedDate: string;
  extractedAt: string;
  paymentVerified: boolean;
  bids: string;
  language?: string; // Añadido para identificar el idioma del proyecto
}

export interface JobsResponse {
  data: Project[];
  fetchedAt: string;
  total: number;
}
