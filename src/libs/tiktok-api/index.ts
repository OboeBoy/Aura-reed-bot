  private async fetchTiktokVideoData(
    videoId: string,
    userAgent: string,
    overrides?: RequestOverrides,
  ): Promise<{
    content: TiktokAwemeItem;
    statistics: TiktokStatistics;
    author: TiktokAuthor;
    music: TiktokMusic;
    formats?: TiktokVideoFormat[];
  } | null> {
    const params = buildTiktokApiParams(videoId);
    const feedUrl = `https://${this.tiktokApiHost}/aweme/v1/feed/?${params}`;

    try {
      const response = await retry<TiktokAPIResponse>(
        async () => {
          const axiosConfig = this.buildAxiosConfig(overrides);
          const res = await this.axios<TiktokAPIResponse>(feedUrl, {
            ...axiosConfig,
            method: 'OPTIONS',
            headers: { 'User-Agent': userAgent },
          });

          if (res.data && res.data.status_code === 0) {
            return res.data;
          }

          throw new Error('Failed to fetch TikTok data');
        },
        {
          retries: 10,
          minTimeout: 200,
          maxTimeout: 1000,
        },
      );

      const content = response?.aweme_list?.find((v) => v.aweme_id === videoId);

      if (!content) {
        return null;
      }

      let statistics: TiktokStatistics;
      try {
        statistics = {
          commentCount: content.statistics?.comment_count || 0,
          likeCount: content.statistics?.digg_count || 0,
          shareCount: content.statistics?.share_count || 0,
          playCount: content.statistics?.play_count || 0,
          downloadCount: content.statistics?.download_count || 0,
        };
      } catch {
        statistics = {
          commentCount: 0,
          likeCount: 0,
          shareCount: 0,
          playCount: 0,
          downloadCount: 0,
        };
      }

      let author: TiktokAuthor;
      try {
        author = {
          uid: content.author?.uid || '',
          username: content.author?.unique_id || '',
          uniqueId: content.author?.unique_id || '',
          nickname: content.author?.nickname || '',
          signature: content.author?.signature || '',
          region: content.author?.region || '',
          avatarThumb: content.author?.avatar_thumb?.url_list || [],
          avatarMedium: content.author?.avatar_medium?.url_list || [],
          url: content.author?.unique_id
            ? `https://www.tiktok.com/@${content.author.unique_id}`
            : '',
        };
      } catch {
        author = {
          uid: '',
          username: '',
          uniqueId: '',
          nickname: '',
          signature: '',
          region: '',
          avatarThumb: [],
          avatarMedium: [],
          url: '',
        };
      }

      let music: TiktokMusic;
      try {
        music = {
          id: String(content.music?.id || ''),
          title: content.music?.title || '',
          author: content.music?.author || '',
          album: content.music?.album || '',
          playUrl: content.music?.play_url?.url_list || [],
          coverLarge: content.music?.cover_large?.url_list || [],
          coverMedium: content.music?.cover_medium?.url_list || [],
          coverThumb: content.music?.cover_thumb?.url_list || [],
          duration: content.music?.duration || 0,
          isCommerceMusic: content.music?.is_commerce_music || false,
          isOriginalSound: content.music?.is_original_sound || false,
          isAuthorArtist: content.music?.is_author_artist || false,
        };
      } catch {
        music = {
          id: '',
          title: '',
          author: '',
          album: '',
          playUrl: [],
          coverLarge: [],
          coverMedium: [],
          coverThumb: [],
          duration: 0,
          isCommerceMusic: false,
          isOriginalSound: false,
          isAuthorArtist: false,
        };
      }

      const formats = this.extractVideoFormats(content);

      return {
        content,
        statistics,
        author,
        music,
        formats,
      };
    } catch (error) {
      console.error('Error fetching TikTok data:', error);
      return null;
    }
  }
