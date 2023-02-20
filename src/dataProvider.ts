import type {
  DataProvider,
  CreateParams,
  GetListParams,
  GetOneParams,
  GetManyParams,
  GetManyReferenceParams,
  UpdateParams as RaUpdateParams,
  UpdateManyParams,
  DeleteParams,
  DeleteManyParams,
} from "ra-core";
import { SupabaseClient } from "@supabase/supabase-js";
import type { GenericSchema } from "@supabase/supabase-js/src/lib/types";

//#region Types
/**
 * An array with a length bigger than 1.
 */
type NonEmptyArray<T> = [T, ...T[]];
/**
 * Flattens an array
 */
type Flatten<T> = T extends Array<infer U> ? U : T;

/**
 * A resource with more specified parameters.
 */
type SpecificResource<
  Schema extends GenericSchema,
  TableName extends keyof Schema["Tables"],
  Table extends Schema["Tables"][TableName] = Schema["Tables"][TableName]
> = {
  table?: TableName;
  fields?: NonEmptyArray<Table["Row"]>;
  fullTextSearchFields?: Table["Row"][];
};

type InternalSpecificResource<
  Schema extends GenericSchema,
  TableName extends keyof Schema["Tables"]
> = SpecificResource<Schema, TableName> &
  Required<Pick<SpecificResource<Schema, TableName>, "table">>;

/**
 * A non empty list of a specific table's fields.
 */
type NotSpecificResource<
  Schema extends GenericSchema,
  TableName extends keyof Schema["Tables"],
  Table extends Schema["Tables"][TableName] = Schema["Tables"][TableName]
> = NonEmptyArray<keyof Table["Row"]>;

export type ResourcesOptions<Schema extends GenericSchema> = Partial<{
  [key in string & keyof Schema["Tables"]]:
    | NotSpecificResource<Schema, key>
    | SpecificResource<Schema, key>;
}>;

type InternalResourcesOptions<Schema extends GenericSchema> = Partial<{
  [key in keyof Schema["Tables"]]: InternalSpecificResource<Schema, key>;
}>;

const isNotSpecificResource = <
  Schema extends GenericSchema,
  Key extends string & keyof Schema["Tables"]
>(
  resource: Key,
  resourceOptions:
    | NotSpecificResource<Schema, Key>
    | SpecificResource<Schema, Key>
): resourceOptions is NotSpecificResource<Schema, Key> =>
  Array.isArray(resourceOptions);

const isSpecificResource = <
  Schema extends GenericSchema,
  Key extends string & keyof Schema["Tables"]
>(
  resource: Key,
  resourceOptions:
    | NotSpecificResource<Schema, Key>
    | SpecificResource<Schema, Key>
): resourceOptions is SpecificResource<Schema, Key> =>
  !Array.isArray(resourceOptions);

type TableNameFinder<
  Resource extends keyof Options & string,
  Schema extends GenericSchema,
  Options extends ResourcesOptions<Schema> = ResourcesOptions<Schema>
> = Options[Resource] extends NotSpecificResource<Schema, Resource>
  ? Resource
  : Options[Resource] extends SpecificResource<Schema, keyof Schema["Tables"]>
  ? Options[Resource]["table"] extends string
    ? Options[Resource]["table"]
    : Resource
  : Resource;
//#endregion

const getInternalResourcesOptions = <Schema extends GenericSchema>(
  options: ResourcesOptions<Schema>
): InternalResourcesOptions<Schema> => {
  const result: InternalResourcesOptions<Schema> = {};
  for (const resource in options) {
    let option = options[resource];
    if (isNotSpecificResource(resource, option)) {
      const x = option;
      const tmp = {
        table: resource,
        fields: option,
        fullTextSearchFields: option,
      } as never as InternalSpecificResource<Schema, typeof resource>;
      result[resource as keyof Schema["Tables"]] = tmp;
    } else if (isSpecificResource(resource, options[resource])) {
      result[resource as keyof Schema["Tables"]] = {
        table: option.table ?? resource,
        fields: option.fields,
        fullTextSearchFields: option.fullTextSearchFields,
      };
    }
  }
  return result;
};

type UpdateParams<T> = Omit<RaUpdateParams<T>, "data"> & {
  data: T;
};

const supabaseDataProvider = <
  Database = any,
  SchemaName extends string & keyof Database = "public" extends keyof Database
    ? "public"
    : string & keyof Database,
  Schema extends GenericSchema = Database[SchemaName] extends GenericSchema
    ? Database[SchemaName]
    : any,
  Options extends ResourcesOptions<Schema> = ResourcesOptions<Schema>
>(
  client: SupabaseClient<Database, SchemaName, Schema>,
  resourcesOptions: Options
): DataProvider<keyof Options & string> => {
  const parsedResourcesOptions = getInternalResourcesOptions(resourcesOptions);

  // #region create
  const create = async <
    Resource extends keyof Options & string,
    TableName extends TableNameFinder<Resource, Schema> = TableNameFinder<
      Resource,
      Schema
    >,
    RecordType extends Schema["Tables"][TableName]["Insert"] = Schema["Tables"][TableName]["Insert"]
  >(
    resource: Resource,
    { data }: CreateParams<RecordType>
  ) => {
    const { data: record, error } = await client
      .from(parsedResourcesOptions[resource].table)
      // @ts-ignore ts is stupid here and I don't know why
      .insert(data)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return { data: record };
  };
  // #endregion

  // #region read

  const getList = async <
    Resource extends keyof Options & string,
    TableName extends TableNameFinder<Resource, Schema> = TableNameFinder<
      Resource,
      Schema
    >,
    RecordType extends Schema["Tables"][TableName]["Row"] = Schema["Tables"][TableName]["Row"]
  >(
    resource: Resource,
    resourceOptions: typeof parsedResourcesOptions[keyof typeof parsedResourcesOptions],
    params: GetListParams
  ) => {
    const {
      pagination,
      sort,
      filter: { q, ...filter },
    } = params;
    const rangeFrom = (pagination.page - 1) * pagination.perPage;
    const rangeTo = rangeFrom + pagination.perPage;

    let query = client
      .from(resourceOptions.table as string)
      .select(resourceOptions.fields.join(", ") || "*", { count: "exact" })
      .order(sort.field, { ascending: sort.order === "ASC" })
      .match(filter)
      .range(rangeFrom, rangeTo);

    if (q) {
      const fullTextSearchFields =
        resourceOptions.fullTextSearchFields ?? resourceOptions.fields;

      fullTextSearchFields.forEach((field) => {
        query = query.ilike(
          field as unknown as keyof RecordType & string,
          `%${q}%`
        );
      });
    }

    const { data, error, count } = await query;
    if (error) {
      throw error;
    }
    return {
      data,
      total: count ?? 0,
    } as unknown as { data: RecordType[]; total: number };
  };

  const getListDP = async <
    Resource extends keyof Options & string,
    TableName extends TableNameFinder<Resource, Schema> = TableNameFinder<
      Resource,
      Schema
    >,
    RecordType extends Schema["Tables"][TableName]["Row"] = Schema["Tables"][TableName]["Row"]
  >(
    resource: Resource,
    params: GetListParams
  ) => {
    const resourceOptions = parsedResourcesOptions[resource];
    return getList(resource, resourceOptions, params);
  };

  const getOne = async <
    Resource extends keyof Options & string,
    TableName extends TableNameFinder<Resource, Schema> = TableNameFinder<
      Resource,
      Schema
    >,
    RecordType extends Schema["Tables"][TableName]["Row"] = Schema["Tables"][TableName]["Row"]
  >(
    resource: Resource,
    // @ts-ignore no way of forcing it, but just make sure it's all with id
    { id }: GetOneParams<RecordType>
  ) => {
    //const data: Schema["Tables"][Resource]["Row"]
    const { data, error } = await client
      .from(parsedResourcesOptions[resource].table)
      .select(parsedResourcesOptions[resource].fields.join(", ") || "*")
      .match({ id })
      .single();

    if (error) {
      throw error;
    }

    return { data } as unknown as { data: RecordType };
  };
  const getMany = async <
    Resource extends keyof Options & string,
    TableName extends TableNameFinder<Resource, Schema> = TableNameFinder<
      Resource,
      Schema
    >,
    RecordType extends Schema["Tables"][TableName]["Row"] = Schema["Tables"][TableName]["Row"]
  >(
    resource: Resource,
    { ids }: GetManyParams
  ) => {
    const { data, error } = await client
      .from(parsedResourcesOptions[resource].table)
      .select(parsedResourcesOptions[resource].fields.join(", ") || "*")
      .in("id", ids);

    if (error) {
      throw error;
    }
    return { data: data ?? [] } as unknown as { data: RecordType[] };
  };
  const getManyReference = async <
    Resource extends keyof Options & string,
    TableName extends TableNameFinder<Resource, Schema> = TableNameFinder<
      Resource,
      Schema
    >,
    RecordType extends Schema["Tables"][TableName]["Row"] = Schema["Tables"][TableName]["Row"]
  >(
    resource: Resource,
    originalParams: GetManyReferenceParams
  ) => {
    const resourceOptions = parsedResourcesOptions[resource];
    const { target, id } = originalParams;
    const params = {
      ...originalParams,
      filter: { ...originalParams.filter, [target]: id },
    };
    return getList(resource, resourceOptions, params);
  };
  // #endregion

  // #region update
  const update = async <
    Resource extends keyof Options & string,
    TableName extends TableNameFinder<Resource, Schema> = TableNameFinder<
      Resource,
      Schema
    >,
    RecordType extends Schema["Tables"][TableName]["Update"] = Schema["Tables"][TableName]["Update"]
  >(
    resource: Resource,
    { id, data }: UpdateParams<RecordType>
  ) => {
    const { data: record, error } = await client
      .from(parsedResourcesOptions[resource].table)
      // @ts-ignore ts is stupid here and I don't know why
      .update(data)
      .match({ id })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return { data: record };
  };
  const updateMany = async <
    Resource extends keyof Options & string,
    TableName extends TableNameFinder<Resource, Schema> = TableNameFinder<
      Resource,
      Schema
    >,
    RecordType extends Schema["Tables"][TableName]["Update"] = Schema["Tables"][TableName]["Update"]
  >(
    resource: Resource,
    { ids, data }: UpdateManyParams<RecordType>
  ) => {
    const { data: records, error } = await client
      .from(parsedResourcesOptions[resource].table)
      // @ts-ignore ts is stupid here and I don't know why
      .update(data)
      .in("id", ids)
      .select("id");

    if (error) {
      throw error;
    }
    return {
      data: records?.map((record) => record["id"]),
    };
  };
  // #endregion

  // #region delete
  const deleteOne = async <
    Resource extends keyof Options & string,
    TableName extends TableNameFinder<Resource, Schema> = TableNameFinder<
      Resource,
      Schema
    >,
    RecordType extends Schema["Tables"][TableName]["Row"] = Schema["Tables"][TableName]["Row"]
  >(
    resource: Resource,
    // @ts-ignore no way of forcing it, but just make sure it's all with id
    { id }: DeleteParams<RecordType>
  ) => {
    const { data } = await getOne(resource, { id });
    const { error } = await client
      .from(parsedResourcesOptions[resource].table)
      .delete()
      .match({ id });

    if (error) {
      throw error;
    }

    return { data };
  };
  const deleteMany = async <
    Resource extends keyof Options & string,
    TableName extends TableNameFinder<Resource, Schema> = TableNameFinder<
      Resource,
      Schema
    >,
    RecordType extends Schema["Tables"][TableName]["Row"] = Schema["Tables"][TableName]["Row"]
  >(
    resource: Resource,
    // @ts-ignore no way of forcing it, but just make sure it's all with id
    { ids }: DeleteManyParams<RecordType>
  ) => {
    const { error } = await client
      .from(parsedResourcesOptions[resource].table)
      .delete()
      .in("id", ids);

    if (error) {
      throw error;
    }
    return {
      data: ids,
    };
  };
  // #endregion

  const provider: DataProvider<keyof Options & string> = {
    // @ts-ignore ts is stupid here and I don't know why
    create,
    // @ts-ignore ts is stupid here and I don't know why
    getList: getListDP,
    getOne,
    getMany,
    // @ts-ignore ts is stupid here and I don't know why
    getManyReference,
    // @ts-ignore ts is stupid here and I don't know why
    update,
    // @ts-ignore ts is stupid here and I don't know why
    updateMany,
    delete: deleteOne,
    deleteMany,
  };
  return provider;
};
