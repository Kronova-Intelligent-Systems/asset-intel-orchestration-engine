// lib/schemas/shipping.ts
import { z } from "zod"

// Define the schema for the origin and destination addresses
const addressSchema = z.object({
  name: z.string().min(1, { message: "Name is required" }),
  street: z.string().min(1, { message: "Street is required" }),
  city: z.string().min(1, { message: "City is required" }),
  state: z.string().min(1, { message: "State is required" }),
  zip: z.string().min(1, { message: "ZIP code is required" }),
  country: z.string().min(1, { message: "Country is required" }),
})

// Define the schema for the shipping record
export const shippingSchema = z.object({
  id: z.string().uuid().optional(),
  tracking_number: z.string().min(1, { message: "Tracking number is required" }),
  carrier: z.string().min(1, { message: "Carrier is required" }),
  service_level: z.string().min(1, { message: "Service level is required" }),
  origin_address: addressSchema,
  destination_address: addressSchema,
  shipping_date: z.string().optional(),
  estimated_delivery: z.string().optional(),
  package_ids: z.array(z.string()).optional(),
  weight: z.coerce.number().min(0).optional(),
  dimensions: z
    .object({
      length: z.coerce.number().min(0),
      width: z.coerce.number().min(0),
      height: z.coerce.number().min(0),
      unit: z.string().default("cm"),
    })
    .optional(),
  shipping_cost: z.coerce.number().min(0).optional(),
  currency: z.string().default("USD"),
  notes: z.string().optional(),
  iot_sensor_id: z.string().optional(), // Add iot_sensor_id
})

export type Shipping = z.infer<typeof shippingSchema>

// Define the schema for reusable packages
export const reusablePackageSchema = z.object({
  id: z.string().uuid().optional(),
  package_id: z.string().min(1, { message: "Package ID is required" }),
  name: z.string().min(1, { message: "Name is required" }),
  description: z.string().optional(),
  dimensions: z.object({
    length: z.coerce.number().min(0, { message: "Length must be positive" }),
    width: z.coerce.number().min(0, { message: "Width must be positive" }),
    height: z.coerce.number().min(0, { message: "Height must be positive" }),
    unit: z.string().default("cm"),
  }),
  weight_capacity: z.coerce.number().min(0, { message: "Weight capacity must be positive" }),
  material: z.string().optional(),
  reuse_count: z.number().int().min(0).default(0),
  status: z.enum(["available", "in_use", "damaged", "retired"]).default("available"),
  location_id: z.string().optional(),
  metadata: z.record(z.string(), z.any()).default({}),
  iot_sensor_id: z.string().optional(), // Add iot_sensor_id
})

export type ReusablePackage = z.infer<typeof reusablePackageSchema>
