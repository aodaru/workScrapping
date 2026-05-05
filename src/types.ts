export interface Project {
  id: string;
  title: string;
  category: string;
  description: string;
  budget: string;
  skills: string[];
  url: string;
  postedDate: string;
  extractedAt: string;
  paymentVerified: boolean;
  bids: string;
  language?: string;
}

export interface JobsResponse {
  data: Project[];
  fetchedAt: string;
  total: number;
}
