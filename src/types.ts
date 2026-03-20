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
}

export interface JobsResponse {
  data: Project[];
  cached: boolean;
  fetchedAt: string;
  total: number;
}
