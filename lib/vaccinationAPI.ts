import { getSupabase } from './supabase';

export interface VaccinationRecord {
  id: string;
  userId: string;
  horseId: string;
  horseName: string;
  vaccineName: string;
  vaccinationDate: string;
  nextDueDate?: string;
  notes?: string;
  reminderEnabled: boolean;
  repeatEnabled: boolean;
  repeatIntervalMonths?: number;
  veterinarianName?: string;
  batchNumber?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVaccinationInput {
  horseId: string;
  horseName: string;
  vaccineName: string;
  vaccinationDate: Date;
  nextDueDate?: Date;
  notes?: string;
  reminderEnabled?: boolean;
  repeatEnabled?: boolean;
  repeatIntervalMonths?: number;
  veterinarianName?: string;
  batchNumber?: string;
}

export interface UpdateVaccinationInput {
  vaccineName?: string;
  vaccinationDate?: Date;
  nextDueDate?: Date;
  notes?: string;
  reminderEnabled?: boolean;
  repeatEnabled?: boolean;
  repeatIntervalMonths?: number;
  veterinarianName?: string;
  batchNumber?: string;
}

/**
 * Create a new vaccination record
 */
export async function createVaccinationRecord(
  input: CreateVaccinationInput
): Promise<{ success: boolean; data?: VaccinationRecord; error?: string }> {
  try {
    const supabase = getSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    const { data, error } = await supabase
      .from('vaccination_records')
      .insert({
        user_id: user.id,
        horse_id: input.horseId,
        horse_name: input.horseName,
        vaccine_name: input.vaccineName,
        vaccination_date: input.vaccinationDate.toISOString(),
        next_due_date: input.nextDueDate?.toISOString(),
        notes: input.notes,
        reminder_enabled: input.reminderEnabled ?? false,
        repeat_enabled: input.repeatEnabled ?? false,
        repeat_interval_months: input.repeatIntervalMonths,
        veterinarian_name: input.veterinarianName,
        batch_number: input.batchNumber,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating vaccination record:', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: mapDatabaseToVaccination(data),
    };
  } catch (error) {
    console.error('Error creating vaccination record:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get vaccination records for a specific horse
 */
export async function getHorseVaccinations(
  horseId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{ success: boolean; data?: VaccinationRecord[]; error?: string }> {
  try {
    const supabase = getSupabase();
    
    let query = supabase
      .from('vaccination_records')
      .select('*')
      .eq('horse_id', horseId)
      .order('vaccination_date', { ascending: false });

    if (startDate && endDate) {
      query = query
        .gte('vaccination_date', startDate.toISOString())
        .lte('vaccination_date', endDate.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching vaccination records:', error);
      return { success: false, error: error.message };
    }

    // Map database records and generate virtual repeating instances
    const allRecords: VaccinationRecord[] = [];
    
    (data || []).forEach((record: any) => {
      const baseRecord = mapDatabaseToVaccination(record);
      const recordDate = new Date(record.vaccination_date);

      // Add the original record if it falls in range or no range specified
      if (!startDate || !endDate || (recordDate >= startDate && recordDate <= endDate)) {
        allRecords.push(baseRecord);
      }

      // Handle repeating vaccinations
      if (record.repeat_enabled && record.repeat_interval_months && startDate && endDate) {
        const instances = generateRepeatingVaccinations(
          baseRecord,
          recordDate,
          startDate,
          endDate
        );
        allRecords.push(...instances);
      }
    });

    // Sort by vaccination date (most recent first)
    allRecords.sort((a, b) =>
      new Date(b.vaccinationDate).getTime() - new Date(a.vaccinationDate).getTime()
    );

    return { success: true, data: allRecords };
  } catch (error) {
    console.error('Error fetching vaccination records:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get all vaccination records for a user
 */
export async function getUserVaccinations(
  startDate?: Date,
  endDate?: Date
): Promise<{ success: boolean; data?: VaccinationRecord[]; error?: string }> {
  try {
    const supabase = getSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    let query = supabase
      .from('vaccination_records')
      .select('*')
      .eq('user_id', user.id)
      .order('vaccination_date', { ascending: false });

    if (startDate && endDate) {
      query = query
        .gte('vaccination_date', startDate.toISOString())
        .lte('vaccination_date', endDate.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching vaccination records:', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: (data || []).map(mapDatabaseToVaccination),
    };
  } catch (error) {
    console.error('Error fetching vaccination records:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Update a vaccination record
 */
export async function updateVaccinationRecord(
  recordId: string,
  input: UpdateVaccinationInput
): Promise<{ success: boolean; data?: VaccinationRecord; error?: string }> {
  try {
    const supabase = getSupabase();
    
    // Extract base UUID from compound ID (for repeating vaccinations)
    const baseId = recordId.includes('_repeat_') 
      ? recordId.split('_repeat_')[0] 
      : recordId;

    const updateData: any = { updated_at: new Date().toISOString() };

    if (input.vaccineName !== undefined) updateData.vaccine_name = input.vaccineName;
    if (input.vaccinationDate !== undefined) updateData.vaccination_date = input.vaccinationDate.toISOString();
    if (input.nextDueDate !== undefined) updateData.next_due_date = input.nextDueDate?.toISOString();
    if (input.notes !== undefined) updateData.notes = input.notes;
    if (input.reminderEnabled !== undefined) updateData.reminder_enabled = input.reminderEnabled;
    if (input.repeatEnabled !== undefined) updateData.repeat_enabled = input.repeatEnabled;
    if (input.repeatIntervalMonths !== undefined) updateData.repeat_interval_months = input.repeatIntervalMonths;
    if (input.veterinarianName !== undefined) updateData.veterinarian_name = input.veterinarianName;
    if (input.batchNumber !== undefined) updateData.batch_number = input.batchNumber;

    const { data, error } = await supabase
      .from('vaccination_records')
      .update(updateData)
      .eq('id', baseId)
      .select()
      .single();

    if (error) {
      console.error('Error updating vaccination record:', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: mapDatabaseToVaccination(data),
    };
  } catch (error) {
    console.error('Error updating vaccination record:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Delete a vaccination record
 */
export async function deleteVaccinationRecord(
  recordId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabase();
    
    // Extract base UUID from compound ID (for repeating vaccinations)
    const baseId = recordId.includes('_repeat_') 
      ? recordId.split('_repeat_')[0] 
      : recordId;

    const { error } = await supabase
      .from('vaccination_records')
      .delete()
      .eq('id', baseId);

    if (error) {
      console.error('Error deleting vaccination record:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting vaccination record:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get upcoming vaccinations (due within next 30 days)
 */
export async function getUpcomingVaccinations(): Promise<{
  success: boolean;
  data?: VaccinationRecord[];
  error?: string;
}> {
  try {
    const supabase = getSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    const today = new Date();
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    const { data, error } = await supabase
      .from('vaccination_records')
      .select('*')
      .eq('user_id', user.id)
      .gte('next_due_date', today.toISOString())
      .lte('next_due_date', thirtyDaysFromNow.toISOString())
      .order('next_due_date', { ascending: true });

    if (error) {
      console.error('Error fetching upcoming vaccinations:', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: (data || []).map(mapDatabaseToVaccination),
    };
  } catch (error) {
    console.error('Error fetching upcoming vaccinations:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Generate repeating vaccination instances within a date range
 */
function generateRepeatingVaccinations(
  baseRecord: VaccinationRecord,
  originalDate: Date,
  startDate: Date,
  endDate: Date
): VaccinationRecord[] {
  const instances: VaccinationRecord[] = [];
  
  if (!baseRecord.repeatEnabled || !baseRecord.repeatIntervalMonths) {
    return instances;
  }

  let currentDate = new Date(originalDate);
  
  // Start from the next occurrence after the original date
  currentDate.setMonth(currentDate.getMonth() + baseRecord.repeatIntervalMonths);

  // Generate instances up to 2 years from original date or end date, whichever is sooner
  const maxDate = new Date(originalDate);
  maxDate.setFullYear(maxDate.getFullYear() + 2);
  const limitDate = endDate < maxDate ? endDate : maxDate;

  while (currentDate <= limitDate) {
    // Only include if it falls within the requested range
    if (currentDate >= startDate && currentDate <= endDate) {
      const nextDueDate = new Date(currentDate);
      nextDueDate.setMonth(nextDueDate.getMonth() + baseRecord.repeatIntervalMonths);

      instances.push({
        ...baseRecord,
        // Create a virtual ID for this instance
        id: `${baseRecord.id}_repeat_${currentDate.toISOString()}`,
        vaccinationDate: currentDate.toISOString(),
        nextDueDate: nextDueDate.toISOString(),
      });
    }

    // Move to next occurrence
    const nextDate = new Date(currentDate);
    nextDate.setMonth(nextDate.getMonth() + baseRecord.repeatIntervalMonths);
    currentDate = nextDate;
  }

  return instances;
}

/**
 * Map database record to VaccinationRecord interface
 */
function mapDatabaseToVaccination(record: any): VaccinationRecord {
  return {
    id: record.id,
    userId: record.user_id,
    horseId: record.horse_id,
    horseName: record.horse_name,
    vaccineName: record.vaccine_name,
    vaccinationDate: record.vaccination_date,
    nextDueDate: record.next_due_date,
    notes: record.notes,
    reminderEnabled: record.reminder_enabled,
    repeatEnabled: record.repeat_enabled,
    repeatIntervalMonths: record.repeat_interval_months,
    veterinarianName: record.veterinarian_name,
    batchNumber: record.batch_number,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}
