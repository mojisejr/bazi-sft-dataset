import { eq } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import { baziUserProfiles, type SelectBaziUserProfile } from "@/db/schema";
import { type RawInputValue } from "@/lib/bazi/schema-types";

export type BaziProfileFields = {
  birthDate: string | null;
  birthTime: string | null;
  gender: string | null;
  province: string | null;
};

export type PersistedBaziUserProfile = {
  clerkUserId: string;
  lineUserId: string | null;
  fields: BaziProfileFields;
  isProfileComplete: boolean;
};

export type BaziUserProfileRepository = {
  findByClerkUserId: (clerkUserId: string) => Promise<PersistedBaziUserProfile | null>;
  upsertPartialByClerkUserId: (input: {
    clerkUserId: string;
    fields: Partial<BaziProfileFields>;
  }) => Promise<PersistedBaziUserProfile | null>;
};

function normalizeProfileField(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

export function mergeBaziProfileFields(
  ...sources: Array<Partial<BaziProfileFields> | null | undefined>
): BaziProfileFields {
  const merged: BaziProfileFields = {
    birthDate: null,
    birthTime: null,
    gender: null,
    province: null,
  };

  for (const source of sources) {
    if (!source) {
      continue;
    }

    const birthDate = normalizeProfileField(source.birthDate);
    const birthTime = normalizeProfileField(source.birthTime);
    const gender = normalizeProfileField(source.gender);
    const province = normalizeProfileField(source.province);

    if (birthDate !== null) {
      merged.birthDate = birthDate;
    }

    if (birthTime !== null) {
      merged.birthTime = birthTime;
    }

    if (gender !== null) {
      merged.gender = gender;
    }

    if (province !== null) {
      merged.province = province;
    }
  }

  return merged;
}

export function hasAnyBaziProfileField(fields: Partial<BaziProfileFields> | null | undefined) {
  if (!fields) {
    return false;
  }

  return [fields.birthDate, fields.birthTime, fields.gender, fields.province]
    .some((value) => normalizeProfileField(value) !== null);
}

export function isBaziProfileComplete(fields: Partial<BaziProfileFields>) {
  return [fields.birthDate, fields.birthTime, fields.gender, fields.province]
    .every((value) => normalizeProfileField(value) !== null);
}

export function toBaziProfileFields(rawInput: Pick<RawInputValue, "birthDate" | "birthTime" | "gender" | "province"> | null | undefined): BaziProfileFields {
  return mergeBaziProfileFields(rawInput ? {
    birthDate: rawInput.birthDate,
    birthTime: rawInput.birthTime,
    gender: rawInput.gender,
    province: rawInput.province,
  } : null);
}

function mapStoredProfile(record: Pick<
  SelectBaziUserProfile,
  "clerkUserId" | "lineUserId" | "birthDate" | "birthTime" | "gender" | "province" | "isProfileComplete"
>): PersistedBaziUserProfile {
  return {
    clerkUserId: record.clerkUserId,
    lineUserId: record.lineUserId ?? null,
    fields: {
      birthDate: record.birthDate ?? null,
      birthTime: record.birthTime ?? null,
      gender: record.gender ?? null,
      province: record.province ?? null,
    },
    isProfileComplete: record.isProfileComplete,
  };
}

export function createBaziUserProfileRepository(
  db = createDbClient(),
): BaziUserProfileRepository {
  return {
    async findByClerkUserId(clerkUserId) {
      const [profile] = await db
        .select({
          clerkUserId: baziUserProfiles.clerkUserId,
          lineUserId: baziUserProfiles.lineUserId,
          birthDate: baziUserProfiles.birthDate,
          birthTime: baziUserProfiles.birthTime,
          gender: baziUserProfiles.gender,
          province: baziUserProfiles.province,
          isProfileComplete: baziUserProfiles.isProfileComplete,
        })
        .from(baziUserProfiles)
        .where(eq(baziUserProfiles.clerkUserId, clerkUserId))
        .limit(1);

      return profile ? mapStoredProfile(profile) : null;
    },
    async upsertPartialByClerkUserId(input) {
      const existingProfile = await this.findByClerkUserId(input.clerkUserId);
      const mergedFields = mergeBaziProfileFields(existingProfile?.fields, input.fields);

      if (!hasAnyBaziProfileField(mergedFields)) {
        return existingProfile;
      }

      const nextProfile = {
        clerkUserId: input.clerkUserId,
        birthDate: mergedFields.birthDate,
        birthTime: mergedFields.birthTime,
        gender: mergedFields.gender,
        province: mergedFields.province,
        isProfileComplete: isBaziProfileComplete(mergedFields),
        updatedAt: new Date(),
      };

      const [savedProfile] = await db
        .insert(baziUserProfiles)
        .values(nextProfile)
        .onConflictDoUpdate({
          target: baziUserProfiles.clerkUserId,
          set: {
            birthDate: nextProfile.birthDate,
            birthTime: nextProfile.birthTime,
            gender: nextProfile.gender,
            province: nextProfile.province,
            isProfileComplete: nextProfile.isProfileComplete,
            updatedAt: nextProfile.updatedAt,
          },
        })
        .returning({
          clerkUserId: baziUserProfiles.clerkUserId,
          lineUserId: baziUserProfiles.lineUserId,
          birthDate: baziUserProfiles.birthDate,
          birthTime: baziUserProfiles.birthTime,
          gender: baziUserProfiles.gender,
          province: baziUserProfiles.province,
          isProfileComplete: baziUserProfiles.isProfileComplete,
        });

      return savedProfile ? mapStoredProfile(savedProfile) : null;
    },
  };
}