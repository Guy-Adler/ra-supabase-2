export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

export interface Database {
  public: {
    Tables: {
      Group: {
        Row: {
          departingCity: string
          endDate: string
          groupName: string
          id: number
          landingCity: string
          startDate: string
        }
        Insert: {
          departingCity: string
          endDate: string
          groupName: string
          id?: number
          landingCity: string
          startDate: string
        }
        Update: {
          departingCity?: string
          endDate?: string
          groupName?: string
          id?: number
          landingCity?: string
          startDate?: string
        }
      }
      GroupHotels: {
        Row: {
          currency: string
          endDate: string
          groupId: number
          hotelId: number
          id: number
          priceSng: number
          priceTwn: number
          startDate: string
          status: string
        }
        Insert: {
          currency: string
          endDate: string
          groupId: number
          hotelId: number
          id?: number
          priceSng?: number
          priceTwn?: number
          startDate: string
          status: string
        }
        Update: {
          currency?: string
          endDate?: string
          groupId?: number
          hotelId?: number
          id?: number
          priceSng?: number
          priceTwn?: number
          startDate?: string
          status?: string
        }
      }
      Hotel: {
        Row: {
          city: string
          hotelName: string
          id: number
        }
        Insert: {
          city: string
          hotelName: string
          id?: number
        }
        Update: {
          city?: string
          hotelName?: string
          id?: number
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
