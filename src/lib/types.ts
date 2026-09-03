import type {
  Fulfillment,
  OrderStatus,
  OrderType,
  PaymentProvider,
  PaymentStatus,
  ReviewStatus,
  Role,
  RxStatus,
  StockStatus,
} from "./constants"

// ---------- API DTOs (contract between frontend & backend) ----------

export interface CategoryDTO {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  productCount: number
}

export interface ProductDTO {
  id: string
  name: string
  sku: string
  brand: string | null
  packSize: string | null
  price: number
  compareAtPrice: number | null
  stockStatus: StockStatus
  stockQty: number
  requiresPrescription: boolean
  description: string
  usageInfo: string | null
  warnings: string | null
  image: string | null
  images?: string[]
  categoryId: string | null
  categoryName?: string | null
  categorySlug?: string | null
  avgRating?: number | null
  reviewCount?: number
}

export interface ReviewDTO {
  id: string
  productId: string
  rating: number
  comment: string | null
  authorName: string
  createdAt: string
}

// Full review record for the admin moderation queue
export interface AdminReviewDTO {
  id: string
  productId: string
  productName: string
  productSku: string
  userId: string
  authorName: string
  authorEmail: string | null
  authorPhone: string | null
  rating: number
  comment: string | null
  status: ReviewStatus
  createdAt: string
}

export interface ReviewSummaryDTO {
  average: number
  count: number
  breakdown: { rating: number; count: number }[]
  reviews: ReviewDTO[]
  mine?: (ReviewDTO & { status: ReviewStatus }) | null
}

export interface StockAlertDTO {
  id: string
  productId: string
  productName: string
  active: boolean
  createdAt: string
}

export interface ProductsResponse {
  items: ProductDTO[]
  total: number
  page: number
  pageSize: number
}

export interface OrderItemDTO {
  id: string
  productId: string | null
  name: string
  price: number
  qty: number
  requiresPrescription: boolean
  lineTotal: number
}

export interface OrderStatusEventDTO {
  id: string
  status: OrderStatus
  note: string | null
  actor: string
  createdAt: string
}

export interface PaymentDTO {
  id: string
  provider: PaymentProvider
  method: string | null
  status: PaymentStatus
  amount: number
  phone: string | null
  cardLast4: string | null
  providerReference: string | null
  failureReason: string | null
  createdAt: string
}

export interface PrescriptionDTO {
  id: string
  fileName: string
  fileType: string
  notes: string | null
  status: RxStatus
  reviewNotes: string | null
  reviewedByName: string | null
  reviewedAt: string | null
  refillsAllowed: number
  refillsUsed: number
  validUntil: string | null
  createdAt: string
  orderId: string | null
  orderReference?: string | null
  fileUrl?: string | null
  storageKey?: string | null
  customerName?: string | null
  customerPhone?: string | null
}

export interface OrderDTO {
  id: string
  reference: string
  type: OrderType
  status: OrderStatus
  fulfillment: Fulfillment
  deliveryAddress: string | null
  deliveryArea: string | null
  deliveryNotes: string | null
  deliveryFee: number
  subtotal: number
  discountAmount: number
  promotionCode: string | null
  total: number
  notes: string | null
  pickupCode: string | null
  customerName: string | null
  customerPhone: string | null
  createdAt: string
  updatedAt: string
  pointsEarned: number
  pointsRedeemed: number
  riderId: string | null
  riderName: string | null
  items: OrderItemDTO[]
  statusHistory: OrderStatusEventDTO[]
  payments: PaymentDTO[]
  prescriptions: PrescriptionDTO[]
}

export interface UserDTO {
  id: string
  name: string | null
  phone: string | null
  email: string | null
  avatar?: string | null
  createdAt: string
  loyaltyPoints: number
}

// Sphere Points loyalty summary for the account page
export interface LoyaltySummaryDTO {
  balance: number
  lifetimeEarned: number
  pendingEarned: number
  redeemedTotal: number
  pointValue: number
  minRedeem: number
  maxRedeemPct: number
  history: {
    orderId: string
    reference: string
    status: OrderStatus
    pointsEarned: number
    pointsRedeemed: number
    createdAt: string
  }[]
}

export interface AddressDTO {
  id: string
  label: string
  text: string
  area: string | null
  notes: string | null
  isDefault: boolean
}

export interface StaffDTO {
  id: string
  name: string
  email: string
  phone: string | null
  role: Role
  title: string | null
  avatar?: string | null
  active: boolean
  createdAt: string
}

export interface NotificationDTO {
  id: string
  channel: string
  event: string | null
  title: string
  message: string
  read: boolean
  createdAt: string
  metadata?: string | null
  staffId?: string | null
}

// Per-channel notification preferences (in-app is always on)
export interface NotificationPrefsDTO {
  sms: boolean
  whatsapp: boolean
  email: boolean
  push: boolean
}

export interface PushTokenPayload {
  token: string
  platform?: string
}

export interface PromotionDTO {
  id: string
  title: string
  description: string
  badge: string | null
  code: string | null
  discountPct: number | null
  color: string | null
  active: boolean
  startsAt: string | null
  endsAt: string | null
}

export interface DeliverySettings {
  mode: "flat" | "zone"
  flatFee: number
  freeOver: number | null
  nightDelivery: boolean
  zones: { name: string; fee: number }[]
}

export interface PharmacySettings {
  name: string
  tagline: string
  phone: string
  whatsapp: string
  email: string
  address: string
  hoursLabel: string
  mapsUrl: string
}

export interface ComplianceInfo {
  premiseLicenceNumber: string
  premiseLicenceExpiry: string
  superintendentName: string
  superintendentReg: string
  notes: string
}

export interface AdminStats {
  ordersToday: number
  revenueToday: number
  ordersThisWeek: number
  revenueThisWeek: number
  revenueTotal: number
  pendingPrescriptions: number
  awaitingPayment: number
  activeOrders: number
  lowStockCount: number
  outOfStockCount: number
  totalProducts: number
  totalCustomers: number
  ordersByDay: { date: string; orders: number; revenue: number }[]
  topProducts: { name: string; qty: number; revenue: number }[]
  rxVsOtc: { otc: number; rx: number }
  statusBreakdown: { status: OrderStatus; count: number }[]
}

export interface AuditLogDTO {
  id: string
  actor: string
  actorRole: string | null
  action: string
  entity: string
  entityId: string | null
  details: string | null
  createdAt: string
}

// ---------- Session ----------

export interface SessionPayload {
  role: Role | "CUSTOMER"
  user?: UserDTO
  staff?: StaffDTO
}
