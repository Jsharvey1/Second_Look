export type Verdict = 'keep' | 'maybe' | 'cut';

export type Status = 'draft' | 'in_review' | 'reviewed';

export interface Work {
  id: string;
  image_path: string;
  width: number | null;
  height: number | null;
  title: string;
  year: string;
  medium: string;
  dimensions: string;
  position: number;
  mentor_position: number | null;
  verdict: Verdict | null;
  note: string;
}

export interface Selection {
  id: string;
  title: string;
  artist_name: string;
  purpose: string;
  status: Status;
  created_at: string;
  reviewed_at: string | null;
  role: 'artist' | 'mentor';
  mentor_token: string | null;
  mentor_name: string;
  overall_note: string;
  works: Work[];
}

export interface ReviewItem {
  id: string;
  verdict: Verdict | null;
  note: string;
  position: number;
}

export interface WorkDetails {
  title: string;
  year: string;
  medium: string;
  dimensions: string;
}

export interface Api {
  createSelection(input: { title: string; artistName: string; purpose: string }): Promise<string>;
  getArtistView(token: string): Promise<Selection | null>;
  getMentorView(token: string): Promise<Selection | null>;
  updateSelection(token: string, input: { title: string; artistName: string; purpose: string }): Promise<void>;
  addWork(
    token: string,
    selectionId: string,
    image: { blob: Blob; width: number; height: number; ext: 'jpg' | 'png' | 'webp' },
    title: string,
  ): Promise<void>;
  updateWork(token: string, workId: string, details: WorkDetails): Promise<void>;
  deleteWork(token: string, workId: string): Promise<void>;
  reorderWorks(token: string, ids: string[]): Promise<void>;
  saveReview(
    token: string,
    input: { mentorName: string; overallNote: string; items: ReviewItem[]; submit: boolean },
  ): Promise<Selection>;
  imageUrl(path: string): string;
}
