import { and, eq } from "drizzle-orm";

import { createDbClient } from "@/db/client";
import { baziDoctrineConfig } from "@/db/schema";
import {
  DOCTRINE_CONFIG_SCOPES,
  EMPTY_DOCTRINE_CONFIG_V2,
  parseDoctrineConfigValue,
  type DoctrineConfigScope,
  type DoctrineConfigV2,
  type RoleConfig,
  type RoleKey,
  type StarConfig,
  type StarKey,
  type StepConfig,
  type StepKey,
} from "@/lib/bazi/doctrine-config";

/**
 * Repository ของ doctrine config v2 (server) — เข้าถึง Neon ผ่าน drizzle
 * โยน error ให้ผู้เรียกจัดการ fallback (loader จะ fallback เป็น default ในโค้ด)
 */
export type DoctrineConfigRepository = {
  load(): Promise<DoctrineConfigV2>;
  upsert(
    scope: DoctrineConfigScope,
    key: string,
    value: StepConfig | RoleConfig | StarConfig,
    updatedBy?: string,
  ): Promise<void>;
  remove(scope: DoctrineConfigScope, key: string): Promise<void>;
};

function isScope(value: string): value is DoctrineConfigScope {
  return (DOCTRINE_CONFIG_SCOPES as readonly string[]).includes(value);
}

export function createDbDoctrineConfigRepository(db = createDbClient()): DoctrineConfigRepository {
  return {
    async load() {
      const rows = await db
        .select({
          scope: baziDoctrineConfig.scope,
          configKey: baziDoctrineConfig.configKey,
          value: baziDoctrineConfig.value,
        })
        .from(baziDoctrineConfig);

      const config: DoctrineConfigV2 = {
        steps: {},
        roles: {},
        stars: {},
      };

      for (const row of rows) {
        if (!isScope(row.scope)) {
          continue;
        }
        const parsed = parseDoctrineConfigValue(row.scope, row.value);
        if (!parsed) {
          continue; // ผิดรูป → fallback เป็น default ของ key นั้น
        }
        if (row.scope === "step") {
          config.steps[row.configKey as StepKey] = parsed as StepConfig;
        } else if (row.scope === "role") {
          config.roles[row.configKey as RoleKey] = parsed as RoleConfig;
        } else {
          config.stars[row.configKey as StarKey] = parsed as StarConfig;
        }
      }
      return config;
    },

    async upsert(scope, key, value, updatedBy) {
      await db
        .insert(baziDoctrineConfig)
        .values({ scope, configKey: key, value, updatedBy: updatedBy ?? null })
        .onConflictDoUpdate({
          target: [baziDoctrineConfig.scope, baziDoctrineConfig.configKey],
          set: { value, updatedBy: updatedBy ?? null },
        });
    },

    async remove(scope, key) {
      await db
        .delete(baziDoctrineConfig)
        .where(and(eq(baziDoctrineConfig.scope, scope), eq(baziDoctrineConfig.configKey, key)));
    },
  };
}

export { EMPTY_DOCTRINE_CONFIG_V2 };
