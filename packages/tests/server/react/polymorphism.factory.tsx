//
// This file contains a useful pattern in tRPC,
//  building factories which can produce common functionality over a homologous data source.
//
import type { AnyRootConfig, createBuilder } from '@trpc/core';
import type { RouterLike, UtilsLike } from '@trpc/react-query/shared';
import { TRPCError } from '@trpc/server';
import z from 'zod';
import type { Config } from './polymorphism.common';
import { t } from './polymorphism.common';

//
// DTOs
//

export const FileExportRequest = z.object({
  name: z.string().min(0),
  filter: z.string().min(0),
});

export const FileExportStatus = z.object({
  id: z.number().min(0),
  name: z.string().min(0),
  downloadUri: z.string().optional(),
  createdAt: z.date(),
});
export type FileExportStatusType = z.infer<typeof FileExportStatus>;

//
// Dependencies
//

type BaseProcedure<TConfig extends AnyRootConfig> = ReturnType<
  typeof createBuilder<TConfig['$types']['ctx'], TConfig['$types']['meta']>
>;

export type DataProvider = FileExportStatusType[];

//
// Set up a route factory which can be re-used for different data sources.
// In this case just with a simple array data source a POC
//

let COUNTER = 1;

export function createExportRoute<TBaseProcedure extends BaseProcedure<Config>>(
  baseProcedure: TBaseProcedure,
  dataProvider: DataProvider,
) {
  return t.router({
    start: baseProcedure
      .input(FileExportRequest)
      .output(FileExportStatus)
      .mutation(async (opts) => {
        const exportInstance: FileExportStatusType = {
          id: COUNTER++,
          name: opts.input.name,
          createdAt: new Date(),
          downloadUri: undefined,
        };

        dataProvider.push(exportInstance);

        return exportInstance;
      }),
    list: baseProcedure.output(z.array(FileExportStatus)).query(async () => {
      return dataProvider;
    }),
    status: baseProcedure
      .input(z.object({ id: z.number().min(0) }))
      .output(FileExportStatus)
      .query(async (opts) => {
        const index = dataProvider.findIndex(
          (item) => item.id === opts.input.id,
        );

        const exportInstance = dataProvider[index];

        if (!exportInstance) {
          throw new TRPCError({
            code: 'NOT_FOUND',
          });
        }

        // When status is polled a second time the download should be ready
        dataProvider[index] = {
          ...exportInstance,
          downloadUri: `example.com/export-${exportInstance.name}.csv`,
        };

        return exportInstance;
      }),
  });
}

//
// Generate abstract types which can be used by the client
//

type ExportRouteType = ReturnType<typeof createExportRoute>;

export type ExportRouteLike = RouterLike<ExportRouteType>;

export type ExportUtilsLike = UtilsLike<ExportRouteType>;
