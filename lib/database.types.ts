export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ads: {
        Row: {
          click_count: number
          created_at: string
          description: string | null
          end_at: string
          id: string
          is_active: boolean
          last_clicked_at: string | null
          placement: string
          provider: string
          start_at: string
          title: string
          updated_at: string
        }
        Insert: {
          click_count?: number
          created_at?: string
          description?: string | null
          end_at: string
          id?: string
          is_active?: boolean
          last_clicked_at?: string | null
          placement: string
          provider?: string
          start_at: string
          title: string
          updated_at?: string
        }
        Update: {
          click_count?: number
          created_at?: string
          description?: string | null
          end_at?: string
          id?: string
          is_active?: boolean
          last_clicked_at?: string | null
          placement?: string
          provider?: string
          start_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      ballet_brands: {
        Row: {
          created_at: string
          facebook_url: string | null
          id: string
          instagram_url: string | null
          is_active: boolean
          logo_url: string | null
          name_en: string | null
          name_ko: string
          naver_blog_url: string | null
          sort_order: number
          threads_url: string | null
          tiktok_url: string | null
          updated_at: string
          website_url: string | null
          x_url: string | null
          youtube_url: string | null
        }
        Insert: {
          created_at?: string
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          is_active?: boolean
          logo_url?: string | null
          name_en?: string | null
          name_ko: string
          naver_blog_url?: string | null
          sort_order?: number
          threads_url?: string | null
          tiktok_url?: string | null
          updated_at?: string
          website_url?: string | null
          x_url?: string | null
          youtube_url?: string | null
        }
        Update: {
          created_at?: string
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          is_active?: boolean
          logo_url?: string | null
          name_en?: string | null
          name_ko?: string
          naver_blog_url?: string | null
          sort_order?: number
          threads_url?: string | null
          tiktok_url?: string | null
          updated_at?: string
          website_url?: string | null
          x_url?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      brand_link_clicks: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          link_type: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          link_type: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          link_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_link_clicks_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "ballet_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_job_runs: {
        Row: {
          counts_json: Json | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          finished_at: string | null
          id: string
          job_name: string
          scheduled_slot: string | null
          started_at: string
          status: string
        }
        Insert: {
          counts_json?: Json | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          job_name: string
          scheduled_slot?: string | null
          started_at?: string
          status: string
        }
        Update: {
          counts_json?: Json | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          job_name?: string
          scheduled_slot?: string | null
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      kopis_facilities: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          fcltychartr: string | null
          fcltynm: string | null
          gugunnm: string | null
          is_active: boolean | null
          mt10id: string
          mt13cnt: number | null
          opende: string | null
          sidonm: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          fcltychartr?: string | null
          fcltynm?: string | null
          gugunnm?: string | null
          is_active?: boolean | null
          mt10id: string
          mt13cnt?: number | null
          opende?: string | null
          sidonm?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          fcltychartr?: string | null
          fcltynm?: string | null
          gugunnm?: string | null
          is_active?: boolean | null
          mt10id?: string
          mt13cnt?: number | null
          opende?: string | null
          sidonm?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      kopis_facility_details: {
        Row: {
          adres: string | null
          cafe: string | null
          created_at: string | null
          deleted_at: string | null
          elevbarrier: string | null
          fcltychartr: string | null
          fcltynm: string | null
          is_active: boolean | null
          la: number | null
          lo: number | null
          mt10id: string
          mt13cnt: number | null
          mt13s: Json | null
          nolibang: string | null
          opende: string | null
          parkbarrier: string | null
          parkinglot: string | null
          relateurl: string | null
          restaurant: string | null
          restbarrier: string | null
          runwbarrier: string | null
          seatscale: string | null
          store: string | null
          suyu: string | null
          telno: string | null
          updated_at: string | null
        }
        Insert: {
          adres?: string | null
          cafe?: string | null
          created_at?: string | null
          deleted_at?: string | null
          elevbarrier?: string | null
          fcltychartr?: string | null
          fcltynm?: string | null
          is_active?: boolean | null
          la?: number | null
          lo?: number | null
          mt10id: string
          mt13cnt?: number | null
          mt13s?: Json | null
          nolibang?: string | null
          opende?: string | null
          parkbarrier?: string | null
          parkinglot?: string | null
          relateurl?: string | null
          restaurant?: string | null
          restbarrier?: string | null
          runwbarrier?: string | null
          seatscale?: string | null
          store?: string | null
          suyu?: string | null
          telno?: string | null
          updated_at?: string | null
        }
        Update: {
          adres?: string | null
          cafe?: string | null
          created_at?: string | null
          deleted_at?: string | null
          elevbarrier?: string | null
          fcltychartr?: string | null
          fcltynm?: string | null
          is_active?: boolean | null
          la?: number | null
          lo?: number | null
          mt10id?: string
          mt13cnt?: number | null
          mt13s?: Json | null
          nolibang?: string | null
          opende?: string | null
          parkbarrier?: string | null
          parkinglot?: string | null
          relateurl?: string | null
          restaurant?: string | null
          restbarrier?: string | null
          runwbarrier?: string | null
          seatscale?: string | null
          store?: string | null
          suyu?: string | null
          telno?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      kopis_performance_awards: {
        Row: {
          awards: string | null
          awards_raw: string | null
          created_at: string
          deleted_at: string | null
          fcltynm: string | null
          genrenm: string | null
          id: string
          is_active: boolean
          mt20id: string
          poster: string | null
          prfnm: string | null
          prfpdfrom: string | null
          prfpdto: string | null
          prfstate: string | null
          updated_at: string
        }
        Insert: {
          awards?: string | null
          awards_raw?: string | null
          created_at?: string
          deleted_at?: string | null
          fcltynm?: string | null
          genrenm?: string | null
          id?: string
          is_active?: boolean
          mt20id: string
          poster?: string | null
          prfnm?: string | null
          prfpdfrom?: string | null
          prfpdto?: string | null
          prfstate?: string | null
          updated_at?: string
        }
        Update: {
          awards?: string | null
          awards_raw?: string | null
          created_at?: string
          deleted_at?: string | null
          fcltynm?: string | null
          genrenm?: string | null
          id?: string
          is_active?: boolean
          mt20id?: string
          poster?: string | null
          prfnm?: string | null
          prfpdfrom?: string | null
          prfpdto?: string | null
          prfstate?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kopis_performance_awards_mt20id_fkey"
            columns: ["mt20id"]
            isOneToOne: false
            referencedRelation: "kopis_performances"
            referencedColumns: ["mt20id"]
          },
          {
            foreignKeyName: "kopis_performance_awards_mt20id_fkey"
            columns: ["mt20id"]
            isOneToOne: false
            referencedRelation: "performance_engagement_summaries"
            referencedColumns: ["performance_id"]
          },
        ]
      }
      kopis_performance_details: {
        Row: {
          area: string | null
          child: string | null
          created_at: string
          daehakro: string | null
          deleted_at: string | null
          dtguidance: string | null
          entrpsnm: string | null
          entrpsnm_a: string | null
          entrpsnm_h: string | null
          entrpsnm_p: string | null
          entrpsnm_s: string | null
          fcltynm: string | null
          festival: string | null
          genrenm: string | null
          is_active: boolean
          mt10id: string | null
          mt20id: string
          musicalcreate: string | null
          musicallicense: string | null
          openrun: string | null
          pcseguidance: string | null
          poster: string | null
          prfage: string | null
          prfcast: string | null
          prfcrew: string | null
          prfnm: string | null
          prfpdfrom: string | null
          prfpdto: string | null
          prfruntime: string | null
          prfstate: string | null
          relates: Json | null
          sty: string | null
          styurls: Json | null
          updated_at: string
          updatedate: string | null
          visit: string | null
        }
        Insert: {
          area?: string | null
          child?: string | null
          created_at?: string
          daehakro?: string | null
          deleted_at?: string | null
          dtguidance?: string | null
          entrpsnm?: string | null
          entrpsnm_a?: string | null
          entrpsnm_h?: string | null
          entrpsnm_p?: string | null
          entrpsnm_s?: string | null
          fcltynm?: string | null
          festival?: string | null
          genrenm?: string | null
          is_active?: boolean
          mt10id?: string | null
          mt20id: string
          musicalcreate?: string | null
          musicallicense?: string | null
          openrun?: string | null
          pcseguidance?: string | null
          poster?: string | null
          prfage?: string | null
          prfcast?: string | null
          prfcrew?: string | null
          prfnm?: string | null
          prfpdfrom?: string | null
          prfpdto?: string | null
          prfruntime?: string | null
          prfstate?: string | null
          relates?: Json | null
          sty?: string | null
          styurls?: Json | null
          updated_at?: string
          updatedate?: string | null
          visit?: string | null
        }
        Update: {
          area?: string | null
          child?: string | null
          created_at?: string
          daehakro?: string | null
          deleted_at?: string | null
          dtguidance?: string | null
          entrpsnm?: string | null
          entrpsnm_a?: string | null
          entrpsnm_h?: string | null
          entrpsnm_p?: string | null
          entrpsnm_s?: string | null
          fcltynm?: string | null
          festival?: string | null
          genrenm?: string | null
          is_active?: boolean
          mt10id?: string | null
          mt20id?: string
          musicalcreate?: string | null
          musicallicense?: string | null
          openrun?: string | null
          pcseguidance?: string | null
          poster?: string | null
          prfage?: string | null
          prfcast?: string | null
          prfcrew?: string | null
          prfnm?: string | null
          prfpdfrom?: string | null
          prfpdto?: string | null
          prfruntime?: string | null
          prfstate?: string | null
          relates?: Json | null
          sty?: string | null
          styurls?: Json | null
          updated_at?: string
          updatedate?: string | null
          visit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kopis_performance_details_mt20id_fkey"
            columns: ["mt20id"]
            isOneToOne: true
            referencedRelation: "kopis_performances"
            referencedColumns: ["mt20id"]
          },
          {
            foreignKeyName: "kopis_performance_details_mt20id_fkey"
            columns: ["mt20id"]
            isOneToOne: true
            referencedRelation: "performance_engagement_summaries"
            referencedColumns: ["performance_id"]
          },
        ]
      }
      kopis_performances: {
        Row: {
          area: string | null
          created_at: string
          deleted_at: string | null
          fcltynm: string | null
          genrenm: string | null
          is_active: boolean
          mt20id: string
          openrun: string | null
          poster: string | null
          prfnm: string
          prfpdfrom: string | null
          prfpdto: string | null
          prfstate: string | null
          updated_at: string
        }
        Insert: {
          area?: string | null
          created_at?: string
          deleted_at?: string | null
          fcltynm?: string | null
          genrenm?: string | null
          is_active?: boolean
          mt20id: string
          openrun?: string | null
          poster?: string | null
          prfnm: string
          prfpdfrom?: string | null
          prfpdto?: string | null
          prfstate?: string | null
          updated_at?: string
        }
        Update: {
          area?: string | null
          created_at?: string
          deleted_at?: string | null
          fcltynm?: string | null
          genrenm?: string | null
          is_active?: boolean
          mt20id?: string
          openrun?: string | null
          poster?: string | null
          prfnm?: string
          prfpdfrom?: string | null
          prfpdto?: string | null
          prfstate?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notice_reads: {
        Row: {
          created_at: string
          notice_id: string
          read_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          notice_id: string
          read_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          notice_id?: string
          read_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notice_reads_notice_id_fkey"
            columns: ["notice_id"]
            isOneToOne: false
            referencedRelation: "notices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notice_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_auth_providers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      notices: {
        Row: {
          content: string
          created_at: string
          id: string
          is_published: boolean
          published_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_published?: boolean
          published_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_published?: boolean
          published_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      performance_booking_clicks: {
        Row: {
          created_at: string
          id: string
          performance_id: string
          relatenm: string | null
          relateurl: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          performance_id: string
          relatenm?: string | null
          relateurl?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          performance_id?: string
          relatenm?: string | null
          relateurl?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "performance_booking_clicks_performance_id_fkey"
            columns: ["performance_id"]
            isOneToOne: false
            referencedRelation: "kopis_performances"
            referencedColumns: ["mt20id"]
          },
          {
            foreignKeyName: "performance_booking_clicks_performance_id_fkey"
            columns: ["performance_id"]
            isOneToOne: false
            referencedRelation: "performance_engagement_summaries"
            referencedColumns: ["performance_id"]
          },
        ]
      }
      performance_review_comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          deleted_at: string | null
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          deleted_at?: string | null
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          deleted_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_review_comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "performance_review_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_review_comment_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_auth_providers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      performance_review_comment_reports: {
        Row: {
          comment_id: string
          created_at: string
          deleted_at: string | null
          id: string
          reason_code: string
          reason_detail: string | null
          reporter_user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          reason_code: string
          reason_detail?: string | null
          reporter_user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          reason_code?: string
          reason_detail?: string | null
          reporter_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_review_comment_reports_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "performance_review_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_review_comment_reports_reporter_user_id_fkey"
            columns: ["reporter_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_review_comments: {
        Row: {
          content: string
          created_at: string
          deleted_at: string | null
          id: string
          review_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          review_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          review_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_review_comments_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "performance_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_review_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_auth_providers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      performance_review_images: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          review_id: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          review_id: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          review_id?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_review_images_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "performance_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_review_images_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_auth_providers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      performance_review_likes: {
        Row: {
          created_at: string
          deleted_at: string | null
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_review_likes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "performance_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_review_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_auth_providers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      performance_review_reports: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          reason_code: string
          reason_detail: string | null
          reporter_user_id: string
          review_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          reason_code: string
          reason_detail?: string | null
          reporter_user_id: string
          review_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          reason_code?: string
          reason_detail?: string | null
          reporter_user_id?: string
          review_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_review_reports_reporter_user_id_fkey"
            columns: ["reporter_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_review_reports_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "performance_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_reviews: {
        Row: {
          content: string | null
          created_at: string
          deleted_at: string | null
          id: string
          performance_id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          performance_id: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          performance_id?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_reviews_performance_id_fkey"
            columns: ["performance_id"]
            isOneToOne: false
            referencedRelation: "kopis_performances"
            referencedColumns: ["mt20id"]
          },
          {
            foreignKeyName: "performance_reviews_performance_id_fkey"
            columns: ["performance_id"]
            isOneToOne: false
            referencedRelation: "performance_engagement_summaries"
            referencedColumns: ["performance_id"]
          },
          {
            foreignKeyName: "performance_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_auth_providers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      performance_views: {
        Row: {
          created_at: string
          id: string
          performance_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          performance_id: string
        }
        Update: {
          created_at?: string
          id?: string
          performance_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_views_performance_id_fkey"
            columns: ["performance_id"]
            isOneToOne: false
            referencedRelation: "kopis_performances"
            referencedColumns: ["mt20id"]
          },
          {
            foreignKeyName: "performance_views_performance_id_fkey"
            columns: ["performance_id"]
            isOneToOne: false
            referencedRelation: "performance_engagement_summaries"
            referencedColumns: ["performance_id"]
          },
        ]
      }
      profiles: {
        Row: {
          app_platform: string | null
          app_platform_updated_at: string | null
          avatar_url: string | null
          ballet_started_at: string | null
          calendar_highlight_weekend: boolean
          calendar_week_start_monday: boolean
          created_at: string
          deleted_at: string | null
          expo_push_token: string | null
          id: string
          is_admin: boolean
          nickname: string | null
          updated_at: string
        }
        Insert: {
          app_platform?: string | null
          app_platform_updated_at?: string | null
          avatar_url?: string | null
          ballet_started_at?: string | null
          calendar_highlight_weekend?: boolean
          calendar_week_start_monday?: boolean
          created_at?: string
          deleted_at?: string | null
          expo_push_token?: string | null
          id: string
          is_admin?: boolean
          nickname?: string | null
          updated_at?: string
        }
        Update: {
          app_platform?: string | null
          app_platform_updated_at?: string | null
          avatar_url?: string | null
          ballet_started_at?: string | null
          calendar_highlight_weekend?: boolean
          calendar_week_start_monday?: boolean
          created_at?: string
          deleted_at?: string | null
          expo_push_token?: string | null
          id?: string
          is_admin?: boolean
          nickname?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "user_auth_providers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      record_media: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          media_type: string
          record_id: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          media_type: string
          record_id: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          media_type?: string
          record_id?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "record_media_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "record_media_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_auth_providers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      records: {
        Row: {
          bar_order: string | null
          center_order: string | null
          content: string
          created_at: string
          deleted_at: string | null
          did_well: string | null
          end_time: string
          id: string
          improve_next: string | null
          instructor: string | null
          level: string | null
          location: string | null
          memo: string | null
          mood: number | null
          record_date: string
          start_time: string
          updated_at: string
          user_id: string
          workout_active_energy_kcal: number | null
          workout_activity_label: string | null
          workout_avg_bpm: number | null
          workout_device_name: string | null
          workout_max_bpm: number | null
          workout_source_name: string | null
          workout_total_energy_kcal: number | null
        }
        Insert: {
          bar_order?: string | null
          center_order?: string | null
          content: string
          created_at?: string
          deleted_at?: string | null
          did_well?: string | null
          end_time: string
          id?: string
          improve_next?: string | null
          instructor?: string | null
          level?: string | null
          location?: string | null
          memo?: string | null
          mood?: number | null
          record_date: string
          start_time: string
          updated_at?: string
          user_id: string
          workout_active_energy_kcal?: number | null
          workout_activity_label?: string | null
          workout_avg_bpm?: number | null
          workout_device_name?: string | null
          workout_max_bpm?: number | null
          workout_source_name?: string | null
          workout_total_energy_kcal?: number | null
        }
        Update: {
          bar_order?: string | null
          center_order?: string | null
          content?: string
          created_at?: string
          deleted_at?: string | null
          did_well?: string | null
          end_time?: string
          id?: string
          improve_next?: string | null
          instructor?: string | null
          level?: string | null
          location?: string | null
          memo?: string | null
          mood?: number | null
          record_date?: string
          start_time?: string
          updated_at?: string
          user_id?: string
          workout_active_energy_kcal?: number | null
          workout_activity_label?: string | null
          workout_avg_bpm?: number | null
          workout_device_name?: string | null
          workout_max_bpm?: number | null
          workout_source_name?: string | null
          workout_total_energy_kcal?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_auth_providers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      saved_bar_orders: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          order_text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          order_text?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          order_text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_bar_orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_auth_providers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      saved_center_orders: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          order_text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          order_text?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          order_text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_center_orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_auth_providers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      saved_instructor_levels: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          instructor: string
          level: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          instructor: string
          level: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          instructor?: string
          level?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_instructor_levels_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_auth_providers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      saved_locations: {
        Row: {
          address_base: string | null
          address_detail: string | null
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address_base?: string | null
          address_detail?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address_base?: string | null
          address_detail?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_locations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_auth_providers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      support_inquiries: {
        Row: {
          content: string
          created_at: string
          deleted_at: string | null
          email: string | null
          id: string
          nickname: string | null
          title: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          nickname?: string | null
          title: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          nickname?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_inquiries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_auth_providers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_consents: {
        Row: {
          agreed_at: string
          created_at: string
          deleted_at: string | null
          id: string
          privacy_version: string
          terms_version: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agreed_at?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          privacy_version: string
          terms_version: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agreed_at?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          privacy_version?: string
          terms_version?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_consents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_auth_providers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      performance_engagement_summaries: {
        Row: {
          comment_count: number | null
          performance_id: string | null
          review_count: number | null
          view_count: number | null
        }
        Relationships: []
      }
      user_auth_providers: {
        Row: {
          created_at: string | null
          email: string | null
          last_sign_in_at: string | null
          provider: string | null
          providers: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          last_sign_in_at?: string | null
          provider?: never
          providers?: never
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          last_sign_in_at?: string | null
          provider?: never
          providers?: never
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_activity_counts_by_user_ids: {
        Args: { user_ids: string[] }
        Returns: {
          comment_count: number
          record_count: number
          review_count: number
          user_id: string
        }[]
      }
      get_calendar_users_count: { Args: never; Returns: number }
      get_performance_users_count: { Args: never; Returns: number }
      purge_soft_deleted_accounts: { Args: never; Returns: Json }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
