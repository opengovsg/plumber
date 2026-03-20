export interface DatabrickColumnRes {
  TABLE_CAT: string
  TABLE_SCHEM: string
  TABLE_NAME: string
  COLUMN_NAME: string
  DATA_TYPE: number
  TYPE_NAME: string
  NULLABLE: number
  IS_NULLABLE: 'YES' | 'NO'
}

export interface DatabrickTableRes {
  TABLE_CAT: string
  TABLE_SCHEM: string
  TABLE_NAME: string
  TABLE_TYPE: string
  REMARKS: string
}
