import { column, Schema, Table } from '@powersync/common'

const sos_alerts = new Table({
    user_id: column.text,
    latitude: column.real,
    longitude: column.real,
    area: column.text,
    station_name: column.text,
    alert_message: column.text,
    status: column.text,
    created_at: column.text,
})

const trusted_contacts = new Table({
    user_id: column.text,
    name: column.text,
    phone: column.text,
    relation: column.text,
    created_at: column.text,
})

const safe_checkins = new Table({
    user_id: column.text,
    area: column.text,
    latitude: column.real,
    longitude: column.real,
    checked_at: column.text,
})

export const AppSchema = new Schema({
    sos_alerts,
    trusted_contacts,
    safe_checkins,
})