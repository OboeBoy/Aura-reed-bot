export const PostItemRequestType = {
  Latest: 0,
  Popular: 1,
  Oldest: 2,
};

export type PostItemRequestType = number;

export interface TiktokUserPostsAPIResponse {
  cursor: string;
  extra: {
    fatal_item_ids: unknown[];
    logid: string;
    now: number;
  };
  hasMore: boolean;
  itemList: any[];
  statusCode: number;
  status_code: number;
  status_msg: string;
}

export type Posts = any;

export type TiktokUserPostsResponse = {
  error?: string;
  statusCode?: number;
  data: any[] | null;
  totalPosts: number;
  hasMore?: boolean;
  cursor?: string;
};
