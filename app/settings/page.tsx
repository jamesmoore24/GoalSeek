'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Calendar, Check, Loader2, ArrowLeft, Watch, Landmark, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { usePlaidLink } from 'react-plaid-link'

interface CalendarInfo {
  id: string
  summary: string
  description?: string
  primary?: boolean
  backgroundColor?: string
}

interface CalendarSettings {
  calendar_sync_enabled: boolean
  share_event_titles: boolean
  share_event_descriptions: boolean
  selected_calendars: string[] | null
}

interface CalendarStatus {
  connected: boolean
  settings: CalendarSettings | null
}

interface FitnessStatus {
  garmin_connected: boolean
}

interface PlaidStatus {
  connected: boolean
  institutionName?: string
  lastSyncAt?: string
  settings?: {
    plaid_sync_enabled: boolean
    plaid_share_account_names: boolean
    plaid_share_transaction_details: boolean
    plaid_share_balances: boolean
  }
}

function SettingsContent() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<CalendarStatus>({ connected: false, settings: null })
  const [calendars, setCalendars] = useState<CalendarInfo[]>([])
  const [selectedCalendars, setSelectedCalendars] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [calendarsLoading, setCalendarsLoading] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [fitnessStatus, setFitnessStatus] = useState<FitnessStatus>({
    garmin_connected: false,
  })
  const [plaidStatus, setPlaidStatus] = useState<PlaidStatus>({ connected: false })
  const [plaidLinkToken, setPlaidLinkToken] = useState<string | null>(null)
  const [plaidSyncing, setPlaidSyncing] = useState(false)
  const [plaidDisconnecting, setPlaidDisconnecting] = useState(false)

  // Handle URL params for success/error messages
  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')

    if (success === 'calendar_connected') {
      toast.success('Google Calendar connected successfully!')
      window.history.replaceState({}, '', '/settings')
    } else if (error) {
      const errorMessages: Record<string, string> = {
        calendar_auth_denied: 'Calendar access was denied',
        calendar_auth_failed: 'Calendar authentication failed',
        invalid_state: 'Invalid authentication state',
        auth_timeout: 'Authentication timed out',
        user_mismatch: 'User verification failed',
        token_exchange_failed: 'Failed to get access token',
        save_failed: 'Failed to save connection',
        auth_required: 'Please log in first',
      }
      toast.error(errorMessages[error] || 'An error occurred')
      window.history.replaceState({}, '', '/settings')
    }
  }, [searchParams])

  const fetchStatus = useCallback(async () => {
    try {
      const [calendarResponse, fitnessResponse, plaidResponse] = await Promise.all([
        fetch('/api/integrations/google/status'),
        fetch('/api/integrations/fitness/status'),
        fetch('/api/integrations/plaid/status'),
      ])

      const calendarData = await calendarResponse.json()
      setStatus(calendarData)
      if (calendarData.settings?.selected_calendars) {
        setSelectedCalendars(calendarData.settings.selected_calendars)
      }

      if (fitnessResponse.ok) {
        const fitnessData = await fitnessResponse.json()
        setFitnessStatus(fitnessData)
      }

      if (plaidResponse.ok) {
        const plaidData = await plaidResponse.json()
        setPlaidStatus(plaidData)
      }
    } catch (error) {
      console.error('Failed to fetch status:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchCalendars = useCallback(async () => {
    if (!status.connected) return

    setCalendarsLoading(true)
    try {
      const response = await fetch('/api/integrations/google/calendars')
      const data = await response.json()
      if (data.calendars) {
        setCalendars(data.calendars)
        if (data.selected && data.selected.length > 0) {
          setSelectedCalendars(data.selected)
        }
      }
    } catch (error) {
      console.error('Failed to fetch calendars:', error)
    } finally {
      setCalendarsLoading(false)
    }
  }, [status.connected])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  useEffect(() => {
    if (status.connected) {
      fetchCalendars()
    }
  }, [status.connected, fetchCalendars])

  const handleConnect = () => {
    window.location.href = '/api/integrations/google/connect'
  }

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      const response = await fetch('/api/integrations/google/disconnect', { method: 'POST' })
      if (response.ok) {
        toast.success('Google Calendar disconnected')
        setStatus({ connected: false, settings: null })
        setCalendars([])
        setSelectedCalendars([])
      } else {
        toast.error('Failed to disconnect')
      }
    } catch {
      toast.error('Failed to disconnect')
    } finally {
      setDisconnecting(false)
    }
  }

  const handleSettingToggle = async (key: keyof CalendarSettings, value: boolean) => {
    try {
      const response = await fetch('/api/integrations/google/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      })
      if (response.ok) {
        setStatus(prev => ({
          ...prev,
          settings: prev.settings ? { ...prev.settings, [key]: value } : null,
        }))
      } else {
        toast.error('Failed to update setting')
      }
    } catch {
      toast.error('Failed to update setting')
    }
  }

  const handleCalendarToggle = (calendarId: string, checked: boolean) => {
    setSelectedCalendars(prev => {
      if (checked) {
        return [...prev, calendarId]
      } else {
        return prev.filter(id => id !== calendarId)
      }
    })
  }

  const saveCalendarSelection = async () => {
    try {
      const response = await fetch('/api/integrations/google/calendars', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selected: selectedCalendars }),
      })
      if (response.ok) {
        toast.success('Calendar selection saved')
      } else {
        toast.error('Failed to save selection')
      }
    } catch {
      toast.error('Failed to save selection')
    }
  }

  // Plaid Link handlers
  const fetchPlaidLinkToken = async () => {
    try {
      const response = await fetch('/api/integrations/plaid/link-token', { method: 'POST' })
      if (response.ok) {
        const data = await response.json()
        setPlaidLinkToken(data.link_token)
      } else {
        toast.error('Failed to initialize Plaid connection')
      }
    } catch {
      toast.error('Failed to initialize Plaid connection')
    }
  }

  const handlePlaidSuccess = async (publicToken: string, metadata: any) => {
    try {
      const response = await fetch('/api/integrations/plaid/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          public_token: publicToken,
          institution: metadata.institution,
        }),
      })
      if (response.ok) {
        toast.success('Financial account connected!')
        fetchStatus()
      } else {
        toast.error('Failed to connect financial account')
      }
    } catch {
      toast.error('Failed to connect financial account')
    }
    setPlaidLinkToken(null)
  }

  const { open: openPlaidLink, ready: plaidReady } = usePlaidLink({
    token: plaidLinkToken,
    onSuccess: handlePlaidSuccess,
    onExit: () => setPlaidLinkToken(null),
  })

  useEffect(() => {
    if (plaidLinkToken && plaidReady) {
      openPlaidLink()
    }
  }, [plaidLinkToken, plaidReady, openPlaidLink])

  const handlePlaidDisconnect = async () => {
    setPlaidDisconnecting(true)
    try {
      const response = await fetch('/api/integrations/plaid/disconnect', { method: 'POST' })
      if (response.ok) {
        toast.success('Financial account disconnected')
        setPlaidStatus({ connected: false })
      } else {
        toast.error('Failed to disconnect')
      }
    } catch {
      toast.error('Failed to disconnect')
    } finally {
      setPlaidDisconnecting(false)
    }
  }

  const handlePlaidSync = async () => {
    setPlaidSyncing(true)
    try {
      const response = await fetch('/api/integrations/plaid/sync', { method: 'POST' })
      if (response.ok) {
        toast.success('Financial data synced')
        fetchStatus()
      } else {
        toast.error('Failed to sync')
      }
    } catch {
      toast.error('Failed to sync')
    } finally {
      setPlaidSyncing(false)
    }
  }

  const handlePlaidSettingToggle = async (key: string, value: boolean) => {
    try {
      const response = await fetch('/api/integrations/plaid/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      })
      if (response.ok) {
        setPlaidStatus(prev => ({
          ...prev,
          settings: prev.settings ? { ...prev.settings, [key]: value } : undefined,
        }))
      } else {
        toast.error('Failed to update setting')
      }
    } catch {
      toast.error('Failed to update setting')
    }
  }

  return (
    <div className="container max-w-2xl py-8 px-4 space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            <CardTitle>Google Calendar</CardTitle>
          </div>
          <CardDescription>
            Connect your calendar to help the AI suggest better times for your pursuits
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : status.connected ? (
            <>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                  <Check className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              </div>

              <Separator />

              {/* Calendar Selection */}
              <div className="space-y-4">
                <h4 className="font-medium">Select Calendars</h4>
                <p className="text-sm text-muted-foreground">
                  Choose which calendars to include in your AI planning context
                </p>

                {calendarsLoading ? (
                  <div className="flex items-center gap-2 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Loading calendars...</span>
                  </div>
                ) : calendars.length > 0 ? (
                  <div className="space-y-3">
                    {calendars.map(calendar => (
                      <div key={calendar.id} className="flex items-start gap-3">
                        <Checkbox
                          id={calendar.id}
                          checked={selectedCalendars.includes(calendar.id)}
                          onCheckedChange={(checked) => handleCalendarToggle(calendar.id, checked === true)}
                        />
                        <div className="flex-1 space-y-1">
                          <label
                            htmlFor={calendar.id}
                            className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2"
                          >
                            {calendar.backgroundColor && (
                              <span
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: calendar.backgroundColor }}
                              />
                            )}
                            {calendar.summary}
                            {calendar.primary && (
                              <Badge variant="outline" className="text-xs">Primary</Badge>
                            )}
                          </label>
                          {calendar.description && (
                            <p className="text-xs text-muted-foreground">{calendar.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                    <Button size="sm" onClick={saveCalendarSelection} className="mt-2">
                      Save Selection
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No calendars found</p>
                )}
              </div>

              <Separator />

              {/* Privacy Settings */}
              <div className="space-y-4">
                <h4 className="font-medium">Privacy Settings</h4>
                <p className="text-sm text-muted-foreground">
                  Control what calendar data is shared with the AI
                </p>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="sync">Enable calendar sync</Label>
                      <p className="text-xs text-muted-foreground">
                        Include calendar in AI planning context
                      </p>
                    </div>
                    <Switch
                      id="sync"
                      checked={status.settings?.calendar_sync_enabled ?? true}
                      onCheckedChange={(v) => handleSettingToggle('calendar_sync_enabled', v)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="titles">Share event titles</Label>
                      <p className="text-xs text-muted-foreground">
                        AI can see event names (e.g., &quot;Team Meeting&quot;)
                      </p>
                    </div>
                    <Switch
                      id="titles"
                      checked={status.settings?.share_event_titles ?? true}
                      onCheckedChange={(v) => handleSettingToggle('share_event_titles', v)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="descriptions">Share event descriptions</Label>
                      <p className="text-xs text-muted-foreground">
                        AI can see event details and notes
                      </p>
                    </div>
                    <Switch
                      id="descriptions"
                      checked={status.settings?.share_event_descriptions ?? false}
                      onCheckedChange={(v) => handleSettingToggle('share_event_descriptions', v)}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <Button
                variant="destructive"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Disconnecting...
                  </>
                ) : (
                  'Disconnect Calendar'
                )}
              </Button>
            </>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect your Google Calendar to let the AI see your schedule and suggest optimal times for your pursuits.
              </p>
              <Button onClick={handleConnect}>
                <Calendar className="h-4 w-4 mr-2" />
                Connect Google Calendar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Garmin Integration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Watch className="h-5 w-5 text-blue-500" />
            <CardTitle>Garmin Connect</CardTitle>
          </div>
          <CardDescription>
            Body Battery, sleep, and heart rate data from Garmin
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : fitnessStatus.garmin_connected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                  <Check className="h-3 w-3 mr-1" />
                  Configured
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Your sleep, heart rate, and Body Battery data will be included in AI planning context.
              </p>
              <p className="text-xs text-muted-foreground">
                Configured via environment variables (GARMIN_EMAIL, GARMIN_PASSWORD)
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Add your Garmin credentials to environment variables to enable Garmin data sync.
              </p>
              <div className="bg-muted p-3 rounded-md">
                <code className="text-xs">
                  GARMIN_EMAIL=your@email.com<br />
                  GARMIN_PASSWORD=your_password
                </code>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plaid Financial Integration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-green-600" />
            <CardTitle>Financial Accounts</CardTitle>
          </div>
          <CardDescription>
            Connect your bank accounts and credit cards via Plaid for financial context
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : plaidStatus.connected ? (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                    <Check className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                  {plaidStatus.institutionName && (
                    <span className="text-sm text-muted-foreground">
                      {plaidStatus.institutionName}
                    </span>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePlaidSync}
                  disabled={plaidSyncing}
                >
                  {plaidSyncing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  <span className="ml-2">Sync</span>
                </Button>
              </div>

              {plaidStatus.lastSyncAt && (
                <p className="text-xs text-muted-foreground">
                  Last synced: {new Date(plaidStatus.lastSyncAt).toLocaleString()}
                </p>
              )}

              <Separator />

              {/* Privacy Settings */}
              <div className="space-y-4">
                <h4 className="font-medium">Privacy Settings</h4>
                <p className="text-sm text-muted-foreground">
                  Control what financial data is shared with the AI
                </p>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="plaid-sync">Enable financial sync</Label>
                      <p className="text-xs text-muted-foreground">
                        Include finances in AI planning context
                      </p>
                    </div>
                    <Switch
                      id="plaid-sync"
                      checked={plaidStatus.settings?.plaid_sync_enabled ?? true}
                      onCheckedChange={(v) => handlePlaidSettingToggle('plaid_sync_enabled', v)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="plaid-accounts">Share account names</Label>
                      <p className="text-xs text-muted-foreground">
                        AI can see account names (e.g., &quot;Chase Checking&quot;)
                      </p>
                    </div>
                    <Switch
                      id="plaid-accounts"
                      checked={plaidStatus.settings?.plaid_share_account_names ?? true}
                      onCheckedChange={(v) => handlePlaidSettingToggle('plaid_share_account_names', v)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="plaid-transactions">Share transaction details</Label>
                      <p className="text-xs text-muted-foreground">
                        AI can see merchant names and categories
                      </p>
                    </div>
                    <Switch
                      id="plaid-transactions"
                      checked={plaidStatus.settings?.plaid_share_transaction_details ?? true}
                      onCheckedChange={(v) => handlePlaidSettingToggle('plaid_share_transaction_details', v)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="plaid-balances">Share balances</Label>
                      <p className="text-xs text-muted-foreground">
                        AI can see account balances and net worth
                      </p>
                    </div>
                    <Switch
                      id="plaid-balances"
                      checked={plaidStatus.settings?.plaid_share_balances ?? true}
                      onCheckedChange={(v) => handlePlaidSettingToggle('plaid_share_balances', v)}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <Button
                variant="destructive"
                onClick={handlePlaidDisconnect}
                disabled={plaidDisconnecting}
              >
                {plaidDisconnecting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Disconnecting...
                  </>
                ) : (
                  'Disconnect Financial Account'
                )}
              </Button>
            </>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect your bank accounts and credit cards to let the AI understand your financial context for better planning.
              </p>
              <Button onClick={fetchPlaidLinkToken}>
                <Landmark className="h-4 w-4 mr-2" />
                Connect Financial Account
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="container max-w-2xl py-8 px-4 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    }>
      <SettingsContent />
    </Suspense>
  )
}
