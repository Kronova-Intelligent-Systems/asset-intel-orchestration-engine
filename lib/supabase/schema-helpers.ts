import { createServerSupabaseClient } from "@/lib/supabase/server"
// Function to ensure the shipping schema exists with all required columns
export async function ensureShippingSchemaExists(): Promise<boolean> {
  const supabase = await createServerSupabaseClient()

  try {
    // First, check if the function exists by trying to use it
    const { data: functionExists, error: functionCheckError } = await supabase
      .from("pg_proc")
      .select("*")
      .eq("proname", "check_column_exists")
      .limit(1)
      .maybeSingle()

    // Create the check_column_exists function with correct parameter order
    // Note: We're creating it regardless of whether it exists to ensure it has the correct signature
    const { error: functionError } = await supabase.sql(`
      CREATE OR REPLACE FUNCTION public.check_column_exists(p_table_name text, p_column_name text)
      RETURNS boolean AS $$
      DECLARE
        column_exists boolean;
      BEGIN
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = p_table_name
          AND column_name = p_column_name
        ) INTO column_exists;
        
        RETURN column_exists;
      END;
      $$ LANGUAGE plpgsql;
    `)

    if (functionError) {
      console.error("Error creating check_column_exists function:", functionError)
      // Continue anyway, as we'll use a fallback method
    }

    // Check if the shipping table exists
    const { data: shippingExists, error: shippingError } = await supabase.from("shipping").select("id").limit(1)

    if (shippingError && shippingError.code !== "PGRST116") {
      // Create the shipping table if it doesn't exist
      const { error: createShippingError } = await supabase.sql(`
        CREATE TABLE IF NOT EXISTS public.shipping (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          tracking_number text NOT NULL,
          status text,
          carrier text,
          weight numeric,
          dimensions jsonb,
          origin_address jsonb,
          destination_address jsonb,
          package_ids uuid[],
          shipping_date timestamp with time zone,
          estimated_delivery timestamp with time zone,
          actual_delivery timestamp with time zone,
          service_level text,
          iot_sensor_id text,
          public_id text,
          created_at timestamp with time zone DEFAULT now(),
          updated_at timestamp with time zone DEFAULT now()
        );
      `)

      if (createShippingError) {
        console.error("Error creating shipping table:", createShippingError)
        return false
      }
    }

    // Check if the reusable_packages table exists
    const { data: packagesExists, error: packagesError } = await supabase
      .from("reusable_packages")
      .select("id")
      .limit(1)

    if (packagesError && packagesError.code !== "PGRST116") {
      // Create the reusable_packages table if it doesn't exist
      const { error: createPackagesError } = await supabase.sql(`
        CREATE TABLE IF NOT EXISTS public.reusable_packages (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          package_id text NOT NULL,
          name text NOT NULL,
          description text,
          dimensions jsonb,
          weight_capacity numeric,
          material text,
          reuse_count integer DEFAULT 0,
          status text,
          location_id text,
          metadata jsonb,
          iot_sensor_id text,
          current_shipment_id uuid,
          shipment_history uuid[],
          created_at timestamp with time zone DEFAULT now(),
          updated_at timestamp with time zone DEFAULT now()
        );
      `)

      if (createPackagesError) {
        console.error("Error creating reusable_packages table:", createPackagesError)
        return false
      }
    }

    // Direct SQL query to check if the package_ids column exists in the shipping table
    const { data: packageIdsColumnData, error: packageIdsColumnError } = await supabase.sql(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'shipping'
        AND column_name = 'package_ids'
      ) as column_exists;
    `)

    const hasPackageIds = packageIdsColumnData?.[0]?.column_exists || false

    if (packageIdsColumnError || !hasPackageIds) {
      // Add the package_ids column if it doesn't exist
      const { error: addPackageIdsError } = await supabase.sql(`
        ALTER TABLE public.shipping 
        ADD COLUMN IF NOT EXISTS package_ids uuid[] DEFAULT NULL;
      `)

      if (addPackageIdsError) {
        console.error("Error adding package_ids column:", addPackageIdsError)
        return false
      }
    }

    // Direct SQL query to check if the current_shipment_id column exists in the reusable_packages table
    const { data: currentShipmentIdColumnData, error: currentShipmentIdColumnError } = await supabase.sql(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'reusable_packages'
        AND column_name = 'current_shipment_id'
      ) as column_exists;
    `)

    const hasCurrentShipmentId = currentShipmentIdColumnData?.[0]?.column_exists || false

    if (currentShipmentIdColumnError || !hasCurrentShipmentId) {
      // Add the current_shipment_id column if it doesn't exist
      const { error: addCurrentShipmentIdError } = await supabase.sql(`
        ALTER TABLE public.reusable_packages 
        ADD COLUMN IF NOT EXISTS current_shipment_id uuid REFERENCES public.shipping(id) NULL;
      `)

      if (addCurrentShipmentIdError) {
        console.error("Error adding current_shipment_id column:", addCurrentShipmentIdError)
        return false
      }
    }

    // Direct SQL query to check if the shipment_history column exists in the reusable_packages table
    const { data: shipmentHistoryColumnData, error: shipmentHistoryColumnError } = await supabase.sql(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'reusable_packages'
        AND column_name = 'shipment_history'
      ) as column_exists;
    `)

    const hasShipmentHistory = shipmentHistoryColumnData?.[0]?.column_exists || false

    if (shipmentHistoryColumnError || !hasShipmentHistory) {
      // Add the shipment_history column if it doesn't exist
      const { error: addShipmentHistoryError } = await supabase.sql(`
        ALTER TABLE public.reusable_packages 
        ADD COLUMN IF NOT EXISTS shipment_history uuid[] DEFAULT '{}';
      `)

      if (addShipmentHistoryError) {
        console.error("Error adding shipment_history column:", addShipmentHistoryError)
        return false
      }
    }

    // Create or replace the update_package_shipment_references function
    const { error: triggerFunctionError } = await supabase.sql(`
      CREATE OR REPLACE FUNCTION update_package_shipment_references()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Check if NEW record has package_ids field and it's not null
        IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
          -- Check if the package_ids column exists and is not null
          IF NEW IS NOT NULL AND 
             EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_schema = 'public' 
                     AND table_name = 'shipping' 
                     AND column_name = 'package_ids') AND
             NEW.package_ids IS NOT NULL THEN
            
            -- For each package ID in the new shipment's package_ids array
            FOREACH package_id IN ARRAY NEW.package_ids
            LOOP
              -- Update the package's current_shipment_id
              UPDATE public.reusable_packages
              SET 
                current_shipment_id = NEW.id,
                shipment_history = array_append(COALESCE(shipment_history, '{}'), NEW.id)
              WHERE id = package_id;
            END LOOP;
          END IF;
        END IF;
        
        -- If this is an update and packages were removed
        IF TG_OP = 'UPDATE' AND 
           EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'shipping' 
                   AND column_name = 'package_ids') AND
           OLD.package_ids IS NOT NULL THEN
          
          -- For each package that was in the old record but not in the new one
          FOREACH package_id IN ARRAY OLD.package_ids
          LOOP
            IF NEW.package_ids IS NULL OR NOT (package_id = ANY(NEW.package_ids)) THEN
              -- Clear the current_shipment_id since it's no longer associated
              UPDATE public.reusable_packages
              SET current_shipment_id = NULL
              WHERE id = package_id AND current_shipment_id = OLD.id;
            END IF;
          END LOOP;
        END IF;
        
        RETURN NEW;
      EXCEPTION
        WHEN OTHERS THEN
          -- Log the error and continue
          RAISE NOTICE 'Error in update_package_shipment_references: %', SQLERRM;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `)

    if (triggerFunctionError) {
      console.error("Error creating trigger function:", triggerFunctionError)
      return false
    }

    // Create the trigger if it doesn't exist
    const { error: triggerError } = await supabase.sql(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'update_package_shipment_references_trigger'
        ) THEN
          CREATE TRIGGER update_package_shipment_references_trigger
          AFTER INSERT OR UPDATE ON public.shipping
          FOR EACH ROW
          EXECUTE FUNCTION update_package_shipment_references();
        END IF;
      END $$;
    `)

    if (triggerError) {
      console.error("Error creating trigger:", triggerError)
      return false
    }

    return true
  } catch (error) {
    console.error("Error in ensureShippingSchemaExists:", error)
    return false
  }
}

// Direct SQL method to check if a column exists in a table
export async function checkColumnExists(tableName: string, columnName: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient()

  try {
    // Use direct SQL query instead of RPC
    const { data, error } = await supabase.sql(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = '${tableName}'
        AND column_name = '${columnName}'
      ) as column_exists;
    `)

    if (error) {
      console.error(`Error checking if column ${columnName} exists in ${tableName}:`, error)
      return false
    }

    return data?.[0]?.column_exists || false
  } catch (error) {
    console.error(`Error in checkColumnExists for ${tableName}.${columnName}:`, error)
    return false
  }
}
