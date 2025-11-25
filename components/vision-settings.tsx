"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Eye, Save, CheckCircle, AlertTriangle, Info } from "lucide-react"

export interface VisionSettings {
  enabled: boolean
  provider: 'local' | 'transformers-js' | 'huggingface' | 'openai' | 'anthropic'
  apiKey?: string
  model?: string
  classifyCharts: boolean
}

interface VisionSettingsProps {
  onSave: (settings: VisionSettings) => void
  initialSettings?: VisionSettings
}

const defaultSettings: VisionSettings = {
  enabled: false,
  provider: 'local',
  classifyCharts: false,
}

export function VisionSettingsComponent({ onSave, initialSettings }: VisionSettingsProps) {
  const [settings, setSettings] = useState<VisionSettings>(initialSettings || defaultSettings)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    onSave(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const requiresApiKey = settings.provider !== 'local' && settings.provider !== 'transformers-js'

  const providerInfo = {
    'local': {
      name: 'Local Placeholder',
      description: 'Basic placeholder captions based on metadata (no AI)',
      cost: 'Free',
      quality: 'Low',
    },
    'transformers-js': {
      name: 'Transformers.js (Client-side)',
      description: 'ViT-GPT2 model running in browser (Nov 2025)',
      cost: 'Free (one-time download)',
      quality: 'Medium',
    },
    'huggingface': {
      name: 'Hugging Face API',
      description: 'BLIP-2 model via Inference API (Nov 2025)',
      cost: 'Free tier available',
      quality: 'Medium-High',
    },
    'openai': {
      name: 'OpenAI GPT-4o Vision',
      description: 'GPT-4 Omni multimodal model (Nov 2025)',
      cost: '$0.01 per image',
      quality: 'Very High',
    },
    'anthropic': {
      name: 'Anthropic Claude 3.5 Vision',
      description: 'Claude 3.5 Sonnet vision capabilities (Nov 2025)',
      cost: '$0.015 per image',
      quality: 'Very High',
    },
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Vision Model Settings
        </CardTitle>
        <CardDescription>
          Configure AI vision models for automatic image captioning and chart classification
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable */}
        <div className="flex items-center justify-between p-3 rounded-md border bg-muted/30">
          <div className="space-y-0.5">
            <Label htmlFor="vision-enabled" className="font-medium">Enable Vision Analysis</Label>
            <p className="text-sm text-muted-foreground">
              Automatically caption and classify extracted images
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span className={`text-xs font-medium ${settings.enabled ? 'text-green-600' : 'text-gray-500'}`}>
              {settings.enabled ? 'ON' : 'OFF'}
            </span>
            <Switch
              id="vision-enabled"
              checked={settings.enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
            />
          </div>
        </div>

        {settings.enabled && (
          <>
            {/* Provider Selection */}
            <div className="space-y-2">
              <Label htmlFor="vision-provider">Vision Provider</Label>
              <Select
                value={settings.provider}
                onValueChange={(value: any) => setSettings({ ...settings, provider: value, apiKey: '' })}
              >
                <SelectTrigger id="vision-provider">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="local">Local Placeholder (Free)</SelectItem>
                  <SelectItem value="transformers-js">Transformers.js (Free, Client-side)</SelectItem>
                  <SelectItem value="huggingface">Hugging Face (Free tier)</SelectItem>
                  <SelectItem value="openai">OpenAI GPT-4 Vision (Paid)</SelectItem>
                  <SelectItem value="anthropic">Anthropic Claude Vision (Paid)</SelectItem>
                </SelectContent>
              </Select>
              
              {/* Provider Info */}
              <div className="rounded-md border p-3 bg-muted/50 text-sm space-y-1">
                <div className="font-medium">{providerInfo[settings.provider].name}</div>
                <div className="text-muted-foreground">{providerInfo[settings.provider].description}</div>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline">{providerInfo[settings.provider].cost}</Badge>
                  <Badge variant="outline">Quality: {providerInfo[settings.provider].quality}</Badge>
                </div>
              </div>
            </div>

            {/* API Key Input */}
            {requiresApiKey && (
              <div className="space-y-2">
                <Label htmlFor="vision-api-key">API Key</Label>
                <Input
                  id="vision-api-key"
                  type="password"
                  placeholder={`Enter your ${settings.provider} API key`}
                  value={settings.apiKey || ''}
                  onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                />
                <p className="text-xs text-muted-foreground flex items-start gap-1">
                  <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span>
                    {settings.provider === 'openai' && 'Get your API key from platform.openai.com'}
                    {settings.provider === 'anthropic' && 'Get your API key from console.anthropic.com'}
                    {settings.provider === 'huggingface' && 'Get your API key from huggingface.co/settings/tokens'}
                  </span>
                </p>
              </div>
            )}

            {/* Model Selection (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="vision-model">Model (Optional)</Label>
              <Input
                id="vision-model"
                placeholder={
                  settings.provider === 'openai' ? 'gpt-4o (default)' :
                  settings.provider === 'anthropic' ? 'claude-3-5-sonnet-20241022 (default)' :
                  settings.provider === 'huggingface' ? 'Salesforce/blip2-opt-2.7b (default)' :
                  settings.provider === 'transformers-js' ? 'Xenova/vit-gpt2-image-captioning (default)' :
                  'Default model'
                }
                value={settings.model || ''}
                onChange={(e) => setSettings({ ...settings, model: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to use the latest stable model (November 2025)
              </p>
            </div>

            {/* Chart Classification */}
            <div className="flex items-center justify-between p-3 rounded-md border bg-muted/30">
              <div className="space-y-0.5">
                <Label htmlFor="classify-charts" className="font-medium">Chart Classification</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically detect and classify chart types
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`text-xs font-medium ${settings.classifyCharts && settings.provider !== 'local' ? 'text-green-600' : 'text-gray-500'}`}>
                  {settings.classifyCharts && settings.provider !== 'local' ? 'ON' : 'OFF'}
                </span>
                <Switch
                  id="classify-charts"
                  checked={settings.classifyCharts}
                  onCheckedChange={(checked) => setSettings({ ...settings, classifyCharts: checked })}
                  disabled={settings.provider === 'local'}
                />
              </div>
            </div>

            {/* Warning for paid providers */}
            {(settings.provider === 'openai' || settings.provider === 'anthropic') && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 flex gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <div className="font-medium text-amber-900">Cost Warning</div>
                  <div className="text-amber-700">
                    {settings.provider === 'openai' && 'OpenAI charges approximately $0.01 per image'}
                    {settings.provider === 'anthropic' && 'Anthropic charges approximately $0.015 per image'}
                    . Processing many images can become expensive.
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Save Button */}
        <div className="flex gap-2">
          <Button onClick={handleSave} className="flex-1">
            <Save className="h-4 w-4 mr-2" />
            Save Settings
          </Button>
          {saved && (
            <div className="flex items-center gap-1 text-green-600 text-sm">
              <CheckCircle className="h-4 w-4" />
              Saved!
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

