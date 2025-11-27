"use client"

import React, { useState } from "react"
import { Filter, X, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"

interface Document {
  id: string
  name: string
}

interface DocumentFilterProps {
  documents: Document[]
  selectedDocumentIds: string[]
  onSelectionChange: (documentIds: string[]) => void
  className?: string
}

export function DocumentFilter({
  documents,
  selectedDocumentIds,
  onSelectionChange,
  className = ""
}: DocumentFilterProps) {
  const [isOpen, setIsOpen] = useState(false)
  
  const isAllSelected = selectedDocumentIds.length === 0 || selectedDocumentIds.length === documents.length
  const selectedCount = isAllSelected ? documents.length : selectedDocumentIds.length

  const handleToggleAll = () => {
    if (isAllSelected) {
      onSelectionChange([])
    } else {
      onSelectionChange(documents.map(d => d.id))
    }
  }

  const handleToggleDocument = (documentId: string) => {
    if (selectedDocumentIds.includes(documentId)) {
      onSelectionChange(selectedDocumentIds.filter(id => id !== documentId))
    } else {
      onSelectionChange([...selectedDocumentIds, documentId])
    }
  }

  const handleClear = () => {
    onSelectionChange([])
  }

  if (documents.length === 0) return null

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      {/* Active Filter Chips */}
      <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
        {isAllSelected ? (
          <Badge 
            variant="outline" 
            className="border-purple-300 bg-purple-50 text-purple-700 px-3 py-1.5 text-xs font-medium"
          >
            All Documents ({documents.length})
          </Badge>
        ) : (
          <>
            {selectedDocumentIds.map(docId => {
              const doc = documents.find(d => d.id === docId)
              if (!doc) return null
              return (
                <Badge
                  key={docId}
                  variant="outline"
                  className="border-purple-300 bg-purple-100 text-purple-700 px-3 py-1.5 text-xs font-medium group"
                >
                  <span className="truncate max-w-[120px] sm:max-w-[200px]">{doc.name}</span>
                  <button
                    onClick={() => handleToggleDocument(docId)}
                    className="ml-1.5 hover:bg-purple-200 rounded-full p-0.5 -mr-1"
                    aria-label={`Remove ${doc.name} filter`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )
            })}
            {selectedDocumentIds.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="h-7 px-2 text-xs text-gray-600 hover:text-gray-900"
              >
                Clear all
              </Button>
            )}
          </>
        )}
      </div>

      {/* Filter Dropdown */}
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 border-2 border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 shrink-0"
          >
            <Filter className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5" />
            <span className="hidden sm:inline">Filter</span>
            <ChevronDown className="w-3 h-3 ml-1.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 sm:w-80">
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>Filter Documents</span>
            {!isAllSelected && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="h-6 px-2 text-xs"
              >
                Clear
              </Button>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <ScrollArea className="h-[200px] sm:h-[300px]">
            <DropdownMenuCheckboxItem
              checked={isAllSelected}
              onCheckedChange={handleToggleAll}
              className="font-medium"
            >
              All Documents ({documents.length})
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            {documents.map(doc => (
              <DropdownMenuCheckboxItem
                key={doc.id}
                checked={selectedDocumentIds.includes(doc.id)}
                onCheckedChange={() => handleToggleDocument(doc.id)}
                className="truncate"
              >
                {doc.name}
              </DropdownMenuCheckboxItem>
            ))}
          </ScrollArea>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

