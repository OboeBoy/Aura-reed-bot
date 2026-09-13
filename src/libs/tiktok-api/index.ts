import retry, { type Options as RetryOptions } from 'async-retry';
import Axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  isAxiosError,
} from 'axios';
import createDebug from 'debug';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { TiktokError } from '../../constants/errors.ts';
import { RETRY_OPTIONS } from '../../constants/retry.ts';
import { TIKTOK_URL, TIKWM_URL, USER_AGENT } from '../../constants/urls.ts';
import { extractMsToken } from '../../utils/helpers.ts';
import { signUrl } from '../../utils/signUrl.ts';

const debug = createDebug('tiktok-api:client');

import { buildTiktokApiParams } from '../downloadVideo/params.ts';
import type {
  TiktokAPIResponse,
  TiktokAuthor,
  TiktokAwemeItem,
  TiktokDownloadResponse,
  TiktokImageResult,
  TiktokMusic,
  TiktokStatistics,
  TiktokVideo,
  TiktokVideoFormat,
  TiktokVideoResult,
} from '../downloadVideo/types.ts';
import { getChallengeParams } from '../getChallenge/params.ts';
import type { TiktokChallengeResponse } from '../getChallenge/types.ts';
import { getSearchParams } from '../getSearch/params.ts';
import type {
  TikwmSearchAPIResponse,
  TikwmSearchImage,
  TikwmSearchVideoItem,
  TiktokSearchResponse,
  TiktokSearchResultItem,
} from '../getSearch/types.ts';
import { getPostParams } from '../getPost/params.ts';
import type {
  TiktokPostDetailAPIResponse,
  TiktokPostResponse,
} from '../getPost/types.ts';
import {
  getCommentRepliesParams,
  getPostCommentsParams,
} from '../getPostComments/params.ts';
import type {
  TiktokComment,
  TiktokCommentListAPIResponse,
  TiktokCommentReplyListAPIResponse,
  TiktokPostCommentsResponse,
} from '../getPostComments/types.ts';
import { getUserParams } from '../getUser/params.ts';
import type { TiktokStalkUserResponse } from '../getUser/types.ts';
import { getUserFollowersParams } from '../getUserFollowers/params.ts';
import type {
  TiktokUserFollower,
  TiktokUserFollowersAPIResponse,
  TiktokUserFollowersResponse,
} from '../getUserFollowers/types.ts';
import { getUserFollowingParams } from '../getUserFollowing/params.ts';
import { getUserPostsParams } from '../getUserPosts/params.ts';
import type {
  PostItemRequestType,
  TiktokPostItem,
  TiktokUserPostsAPIResponse,
  TiktokUserPostsResponse,
} from '../getUserPosts/types.ts';

type ClientOptions = {
  proxy?: string | null;
  region: string;
  msToken?: string;
  retryOptions?: RetryOptions;
  tiktokApiHost?: string;
};

type RequestOverrides = {
  proxy?: string | null;
  region?: string;
  msToken?: string;
  retryOptions?: RetryOptions;
};

const DEFAULT_POST_COUNT = 16;
const FIRST_PAGE_POST_COUNT = 35;

export class TikTokClient {
  private readonly axios: AxiosInstance;
  private readonly region: string;
  private readonly defaultHttpsAgent?: HttpsProxyAgent<string>;
  private readonly retryOptions: RetryOptions;
  private readonly tiktokApiHost: string;
  private msToken?: string;

  constructor(options: ClientOptions) {
    this.region = options.region;
    this.msToken = options.msToken;
    this.tiktokApiHost =
      options.tiktokApiHost || 'api16-normal-c-useast1a.tiktokv.com';

    this.defaultHttpsAgent = options.proxy
      ? new HttpsProxyAgent(options.proxy)
      : undefined;

    this.retryOptions = options.retryOptions
      ? { ...RETRY_OPTIONS, ...options.retryOptions }
      : RETRY_OPTIONS;

    this.axios = Axios.create({
      headers: { 'user-agent': USER_AGENT },
    });
  }

  private resolveRegion(overrides?: RequestOverrides): string {
    return overrides?.region ?? this.region;
  }

  private resolveMsToken(overrides?: RequestOverrides): string | undefined {
    return overrides?.msToken ?? this.msToken;
  }

  private resolveRetryOptions(overrides?: RetryOptions): RetryOptions {
    return overrides
      ? { ...this.retryOptions, ...overrides }
      : this.retryOptions;
  }

  private buildAxiosConfig(
    overrides?: RequestOverrides,
  ): AxiosRequestConfig | undefined {
    if (overrides?.proxy === undefined) {
      return this.defaultHttpsAgent
        ? { httpsAgent: this.defaultHttpsAgent }
        : undefined;
    }

    if (overrides.proxy) {
      return { httpsAgent: new HttpsProxyAgent(overrides.proxy) };
    }

    return { httpsAgent: undefined };
  }

  public async getUser(
    username: string,
    overrides?: RequestOverrides,
  ): Promise<TiktokStalkUserResponse> {
    try {
      const sanitizedUsername = username.replace('@', '');
      let extractedMsToken: string | undefined;
      const axiosConfig = this.buildAxiosConfig(overrides);
      const region = this.resolveRegion(overrides);
      let activeMsToken = this.resolveMsToken(overrides);
      const retryOptions = this.resolveRetryOptions(overrides?.retryOptions);

      const data = await retry(async (bail, attemptNumber) => {
        try {
          const params = getUserParams({
            username: sanitizedUsername,
            userAgent: USER_AGENT,
            msToken: activeMsToken,
            region,
          });

          const signedUrl = signUrl({
            url: `${TIKTOK_URL}/api/user/detail`,
            params,
            body: '',
            userAgent: USER_AGENT,
          });

          const { data, headers } = await this.axios.get(
            signedUrl,
            axiosConfig,
          );

          const newMsToken = extractMsToken(headers);
          if (newMsToken) {
            extractedMsToken = newMsToken;
            this.msToken = newMsToken;
            activeMsToken = newMsToken;
          }

          if (!data || (typeof data === 'string' && data === '')) {
            const fallbackResult = await this.getUserFromProfilePage(
              username,
              overrides,
            );
            if (fallbackResult.data) {
              return fallbackResult.data;
            }
            throw new Error('API_EMPTY_RESPONSE');
          }

          if (
            [
              TiktokError.USER_NOT_EXIST,
              TiktokError.USER_BAN,
              TiktokError.USER_PRIVATE,
              TiktokError.INVALID_PROFILE,
            ].includes(data.statusCode)
          ) {
            bail(new Error('USER_NOT_EXIST'));
            return null;
          }

          if (
            !data.userInfo?.user?.uniqueId ||
            Object.keys(data.userInfo?.user || {}).length === 0
          ) {
            const fallbackResult = await this.getUserFromProfilePage(
              username,
              overrides,
            );
            if (fallbackResult.data) {
              return fallbackResult.data;
            }
            throw new Error('API_AND_FALLBACK_EMPTY');
          }

          return data;
        } catch (error: unknown) {
          if (
            isAxiosError(error) &&
            (error.response?.status === 400 ||
              error.response?.data?.statusCode === TiktokError.INVALID_ENTITY)
          ) {
            bail(new Error('INVALID_ENTITY'));
            return null;
          }

          const fallbackResult = await this.getUserFromProfilePage(
            username,
            overrides,
          );

          if (fallbackResult.data) {
            return fallbackResult.data;
          }

          throw error;
        }
      }, retryOptions);

      return { data, msToken: extractedMsToken, method: 'api' };
    } catch (error: unknown) {
      if ((error as Error).message === 'USER_NOT_EXIST') {
        return {
          error: 'USER_NOT_EXIST',
          statusCode: TiktokError.USER_NOT_EXIST,
          data: null,
        };
      }

      if ((error as Error).message === 'INVALID_ENTITY') {
        return {
          error: 'INVALID_ENTITY',
          statusCode: TiktokError.INVALID_ENTITY,
          data: null,
        };
      }

      return {
        error: 'UNKNOWN_ERROR',
        statusCode: 0,
        data: null,
      };
    }
  }

  public async getChallenge(
    hashtag: string,
    overrides?: RequestOverrides,
  ): Promise<{
    error?: string;
    statusCode?: number;
    data: TiktokChallengeResponse | null;
  }> {
    try {
      const axiosConfig = this.buildAxiosConfig(overrides);
      const region = this.resolveRegion(overrides);
      let activeMsToken = this.resolveMsToken(overrides);
      const retryOptions = this.resolveRetryOptions(overrides?.retryOptions);

      const data = await retry(async (bail) => {
        try {
          const params = getChallengeParams({
            hashtag,
            userAgent: USER_AGENT,
            msToken: activeMsToken,
            region,
          });

          const signedUrl = signUrl({
            url: `${TIKTOK_URL}/api/challenge/detail`,
            params,
            body: '',
            userAgent: USER_AGENT,
          });

          const { data, headers } =
            await this.axios.get<TiktokChallengeResponse>(
              signedUrl,
              axiosConfig,
            );

          const newMsToken = extractMsToken(headers);
          if (newMsToken) {
            this.msToken = newMsToken;
            activeMsToken = newMsToken;
          }

          if (data.statusCode === TiktokError.HASHTAG_NOT_EXIST) {
            bail(new Error('HASHTAG_NOT_EXIST'));
            return null;
          }

          return data;
        } catch (error: any) {
          if (
            error.response?.status === 400 ||
            error.response?.data?.statusCode === TiktokError.INVALID_ENTITY
          ) {
            bail(new Error('INVALID_ENTITY'));
            return null;
          }
          throw error;
        }
      }, retryOptions);

      return { data };
    } catch (error: any) {
      if (error?.message === 'HASHTAG_NOT_EXIST') {
        return {
          error: 'HASHTAG_NOT_EXIST',
          statusCode: TiktokError.HASHTAG_NOT_EXIST,
          data: null,
        };
      }

      return {
        error: 'UNKNOWN_ERROR',
        statusCode: 0,
        data: null,
      };
    }
  }

  public async getPost(
    itemId: string,
    overrides?: RequestOverrides,
  ): Promise<TiktokPostResponse> {
    try {
      const data = await this.fetchPost(itemId, overrides);
      const statusCode = data?.statusCode ?? data?.status_code ?? 0;
      const item = data?.itemInfo?.itemStruct;

      if (!item) {
        return {
          error: 'VIDEO_NOT_FOUND',
          statusCode,
          data: null,
        };
      }

      return {
        data: item,
        statusCode,
      };
    } catch (err: any) {
      if (
        err.status === 400 ||
        (err.response?.data &&
          (err.response.data.statusCode === TiktokError.INVALID_ENTITY ||
            err.response.data.status_code === TiktokError.INVALID_ENTITY))
      ) {
        return {
          error: 'INVALID_ENTITY',
          statusCode: TiktokError.INVALID_ENTITY,
          data: null,
        };
      }

      if (err.message === 'EMPTY_RESPONSE') {
        return {
          error: 'EMPTY_RESPONSE',
          statusCode: 0,
          data: null,
        };
      }

      return {
        error: 'UNKNOWN_ERROR',
        statusCode: 0,
        data: null,
      };
    }
  }

  public async getUserPosts(
    secUid: string,
    options?: {
      postLimit?: number;
      nextCursor?: number;
      requestType?: PostItemRequestType;
    } & RequestOverrides,
  ): Promise<TiktokUserPostsResponse> {
    try {
      const posts: TiktokPostItem[] = [];
      const seenIds = new Set<string>();
      let hasMore = true;
      let cursor = options?.nextCursor ?? 0;
      const postLimit = options?.postLimit ?? 35;
      let isFirstPage = cursor === 0;
      let lastCursor: string | undefined;

      while (hasMore) {
        const count = isFirstPage ? FIRST_PAGE_POST_COUNT : DEFAULT_POST_COUNT;
        const pageResult = await this.fetchUserPostsPage(
          secUid,
          count,
          cursor,
          options?.requestType,
          options,
        );

        const list = pageResult?.itemList ?? [];
        for (const item of list) {
          if (seenIds.has(item.id)) {
            continue;
          }
          posts.push(item);
          seenIds.add(item.id);
        }

        hasMore = Boolean(pageResult?.hasMore);
        if (pageResult?.cursor !== undefined) {
          lastCursor = String(pageResult.cursor);
        }
        cursor = hasMore ? Number(pageResult?.cursor ?? 0) : 0;
        isFirstPage = false;

        if (postLimit && posts.length >= postLimit) {
          hasMore = false;
        }
      }
      if (!posts.length) {
        return {
          error: 'USER_NOT_FOUND',
          statusCode: TiktokError.USER_NOT_EXIST,
          data: null,
          totalPosts: 0,
        };
      }

      const trimmedPosts = postLimit ? posts.slice(0, postLimit) : posts;

      return {
        data: trimmedPosts,
        totalPosts: trimmedPosts.length,
        hasMore,
        cursor: lastCursor,
      };
    } catch (err: any) {
      if (
        err.status === 400 ||
        (err.response?.data &&
          err.response.data.statusCode === TiktokError.INVALID_ENTITY)
      ) {
        return {
          error: 'VIDEO_NOT_FOUND',
          statusCode: TiktokError.INVALID_ENTITY,
          data: null,
          totalPosts: 0,
        };
      }

      if (err.message === 'EMPTY_RESPONSE') {
        return {
          error: 'EMPTY_RESPONSE',
          statusCode: 0,
          data: null,
          totalPosts: 0,
        };
      }

      return {
        error: 'UNKNOWN_ERROR',
        statusCode: 0,
        data: null,
        totalPosts: 0,
      };
    }
  }

  public async search(
    keyword: string,
    options?: {
      resultLimit?: number;
      cursor?: number;
      hd?: boolean;
    } & RequestOverrides,
  ): Promise<TiktokSearchResponse> {
    const resultLimit = options?.resultLimit ?? 10;
    const cursor = options?.cursor ?? 0;
    const hd = options?.hd ?? true;
    const axiosConfig = this.buildAxiosConfig(options);

    try {
      const params = getSearchParams({
        keyword,
        count: resultLimit,
        cursor,
        hd,
      });

      const response = await this.axios.get<TikwmSearchAPIResponse>(
        `${TIKWM_URL}/api/feed/search`,
        {
          ...axiosConfig,
          params,
          validateStatus: () => true,
          headers: {
            ...(axiosConfig?.headers || {}),
            accept: 'application/json, text/plain, */*',
            'accept-language': 'en-US,en;q=0.9',
            referer: `${TIKWM_URL}/`,
          },
        },
      );

      const { data, status } = response;

      if (!data || data.code !== 0) {
        return {
          error: data?.msg || `SEARCH_REQUEST_FAILED (status ${status})`,
          query: keyword,
          data: null,
          totalResults: 0,
          hasMore: false,
          cursor: '0',
        };
      }

      const videos = data.data?.videos ?? [];
      const results = videos.map((video) => this.mapTikwmSearchItem(video));

      if (!results.length) {
        return {
          error: 'SEARCH_NO_RESULTS',
          query: keyword,
          data: null,
          totalResults: 0,
          hasMore: false,
          cursor: '0',
        };
      }

      return {
        query: keyword,
        data: results,
        totalResults: results.length,
        hasMore: Boolean(data.data?.hasMore),
        cursor: String(data.data?.cursor ?? '0'),
      };
    } catch (error: any) {
      return {
        error: error?.message || 'UNKNOWN_ERROR',
        query: keyword,
        data: null,
        totalResults: 0,
        hasMore: false,
        cursor: '0',
      };
    }
  }

  private mapTikwmSearchItem(
    video: TikwmSearchVideoItem,
  ): TiktokSearchResultItem {
    const images = this.normalizeTikwmImages(video.images);
    const isSlideshow = Boolean(images && images.length > 0);
    const id = video.video_id || video.aweme_id || null;
    const uniqueId = video.author?.unique_id || null;

    return {
      id,
      type: isSlideshow ? 'slideshow' : 'video',
      desc: video.title || '',
      videoUrl: !isSlideshow ? video.hdplay || video.play || null : null,
      videoUrlWatermarked: !isSlideshow ? video.wmplay || null : null,
      images: isSlideshow ? images : null,
      cover: video.cover || video.origin_cover || null,
      duration: Number(video.duration) || 0,
      statistics: {
        likeCount: Number(video.digg_count) || 0,
        commentCount: Number(video.comment_count) || 0,
        shareCount: Number(video.share_count) || 0,
        playCount: Number(video.play_count) || 0,
        downloadCount: Number(video.download_count) || 0,
      },
      createTime: video.create_time
        ? new Date(Number(video.create_time) * 1000).toISOString()
        : null,
      music: {
        title: video.music_info?.title || null,
        author: video.music_info?.author || null,
        url: video.music || video.music_info?.play || null,
      },
      author: {
        id: video.author?.id || null,
        uniqueId,
        nickname: video.author?.nickname || '',
        avatar: video.author?.avatar || null,
      },
      postUrl: uniqueId && id ? `${TIKTOK_URL}/@${uniqueId}/video/${id}` : null,
    };
  }

  private normalizeTikwmImages(
    images: Array<string | TikwmSearchImage> | undefined,
  ): string[] | null {
    if (!Array.isArray(images)) return null;
    return images
      .map((image) =>
        typeof image === 'string'
          ? image
          : image?.url || image?.display_image?.url_list?.[0] || null,
      )
      .filter((url): url is string => Boolean(url));
  }

  public async getUserFollowers(
    secUid: string,
    options?: {
      followerLimit?: number;
      count?: number;
      cursor?: number;
    } & RequestOverrides,
  ): Promise<TiktokUserFollowersResponse> {
    try {
      const followers: TiktokUserFollower[] = [];
      const seenIds = new Set<string>();
      const count = options?.count ?? 30;
      const followerLimit = options?.followerLimit ?? count;
      let cursor = options?.cursor ?? 0;
      let hasMore = true;
      let lastCursor = cursor;

      while (hasMore) {
        const page = await this.fetchUserFollowersPage(
          secUid,
          count,
          cursor,
          options,
        );

        const statusCode = page?.statusCode ?? page?.status_code ?? 0;
        if (
          statusCode === TiktokError.USER_NOT_EXIST ||
          statusCode === TiktokError.USER_BAN ||
          statusCode === TiktokError.USER_PRIVATE
        ) {
          return {
            error: 'USER_NOT_FOUND',
            statusCode,
            data: null,
            totalFollowers: 0,
            hasMore: false,
            cursor: lastCursor,
          };
        }

        const list = page?.userList ?? [];
        for (const follower of list) {
          const key =
            follower.user?.id ||
            follower.user?.secUid ||
            follower.user?.uniqueId;
          if (key && seenIds.has(key)) {
            continue;
          }
          followers.push(follower);
          if (key) {
            seenIds.add(key);
          }
        }

        hasMore = Boolean(page?.hasMore);
        if (page?.minCursor !== undefined) {
          lastCursor = Number(page.minCursor);
        }
        cursor = hasMore ? Number(page?.minCursor ?? 0) : 0;

        if (!hasMore || list.length < count) {
          hasMore = false;
        }

        if (followerLimit && followers.length >= followerLimit) {
          hasMore = false;
        }

        if (hasMore && cursor === lastCursor && list.length === 0) {
          hasMore = false;
        }
      }

      const trimmedFollowers =
        followerLimit && followers.length > followerLimit
          ? followers.slice(0, followerLimit)
          : followers;

      return {
        data: trimmedFollowers,
        totalFollowers: trimmedFollowers.length,
        hasMore,
        cursor: lastCursor,
        statusCode: 0,
     
