export type ValidationStatus =
  | 'valid'
  | 'invalid'
  | 'catch-all'
  | 'unknown'
  | 'spamtrap'
  | 'abuse'
  | 'do_not_mail'

export type ValidationSubStatus =
  | 'antispam_system'
  | 'does_not_accept_mail'
  | 'exception_occurred'
  | 'failed_smtp_connection'
  | 'forcible_disconnect'
  | 'global_suppression'
  | 'greylisted'
  | 'leading_period_removed'
  | 'mail_server_did_not_respond'
  | 'mail_server_temporary_error'
  | 'mailbox_not_found'
  | 'mailbox_quota_exceeded'
  | 'possible_typo'
  | 'possible_trap'
  | 'role_based'
  | 'timeout_exceeded'
  | 'unroutable_ip_address'
  | 'disposable'
  | 'toxic'
  | 'role_based_catch_all'
  | 'mx_forward'
  | 'alternate'
  | 'allowed'
  | 'invalid_format'
  | ''

export interface SingleValidationResult {
  address: string
  status: ValidationStatus
  sub_status: ValidationSubStatus
  free_email: boolean
  did_you_mean: string | null
  account: string
  domain: string
  domain_age_days: string
  smtp_provider: string
  mx_found: string
  mx_record: string
  firstname: string
  lastname: string
  gender: string
  country: string
  region: string
  city: string
  zipcode: string
  processed_at: string
}

export interface BatchResult {
  email: string
  status: ValidationStatus
  sub_status: ValidationSubStatus
}

export interface FileUploadResponse {
  success: boolean
  message: string
  file_name: string
  file_id: string
}

export interface FileStatusResponse {
  success: boolean
  file_id: string
  file_name: string
  upload_date: string
  file_status: 'Complete' | 'Processing' | 'Pending'
  complete_percentage: string
  error_reason: string | null
  return_url: string
}
