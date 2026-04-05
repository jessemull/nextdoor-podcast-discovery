"use client";

import {
  AlertTriangle,
  ArrowUpDown,
  CheckSquare,
  Filter,
  Inbox,
  RotateCcw,
  Search,
  SearchX,
  X,
} from "lucide-react";

import {
  GENERIC_ERROR_MESSAGE_LINE_1,
  GENERIC_ERROR_MESSAGE_LINE_2,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

import { FeedSearchBar } from "../FeedSearchBar";
import { FilterSidebar } from "../FilterSidebar";
import { PostCard } from "../PostCard";
import { PostCardSkeleton } from "../PostCardSkeleton";
import { ConfirmModal } from "../ui/ConfirmModal";
import { CustomSelect } from "../ui/CustomSelect";
import {
  BULK_ACTION_LABELS,
  BULK_ACTION_SUCCESS,
  BULK_ACTION_TITLES,
  SKELETON_CARD_COUNT,
  SORT_OPTIONS,
} from "./post-feed-constants";

import type { PostFeedViewModel } from "./usePostFeedModel";

interface PostFeedLayoutProps {
  model: PostFeedViewModel;
}

export function PostFeedLayout({ model }: PostFeedLayoutProps) {
  const {
    activeConfigWeights,
    activeFilterCount,
    addingIds,
    bulkMode,
    confirmModal,
    countLoading,
    currentSortOption,
    error,
    examplesFull,
    feedBulkActionOptions,
    filterLoadError,
    filters,
    focusedIndex,
    getActiveJobForPost,
    getQueueStatusForPost,
    handleAddToScoringFewShot,
    handleBulkAction,
    handleBulkActionMenuChange,
    handleCancelRefresh,
    handleMarkIgnored,
    handleMarkSaved,
    handleMarkUsedChange,
    handleQueueRefresh,
    handleResetFilters,
    hasMore,
    initialLoading,
    loadingMore,
    markingIgnored,
    markingSaved,
    markingUsed,
    neighborhoods,
    openFilterDrawer,
    pendingPostAction,
    picksDefaults,
    postRefs,
    posts,
    refetchPermalinkJobs,
    requestCancelRefresh,
    requestMarkIgnored,
    requestMarkUsedChange,
    requestQueueRefresh,
    router,
    searchSlot,
    searchTypeMenuOpen,
    searchTypeMenuRef,
    selectAllCheckboxRef,
    selectAllChecked,
    selectedIds,
    sentinelRef,
    setBulkMode,
    setConfirmModal,
    setCountLoading,
    setFilters,
    setOpenFilterDrawer,
    setPendingPostAction,
    setSearchTypeMenuOpen,
    setSelectAllChecked,
    setSelectedIds,
    setSortMenuOpen,
    similarSearchListPath,
    sortMenuOpen,
    sortMenuRef,
    toast,
    toggleSelect,
    total,
  } = model;

  return (
    <div className="flex min-h-0 flex-1 gap-4 sm:gap-6">
      {/* Desktop sidebar */}
      <div className="hidden h-full w-64 shrink-0 md:block">
          <FilterSidebar
            activeConfigWeights={
              activeConfigWeights as null | Record<string, number>
            }
            filterLoadError={filterLoadError}
          filters={filters}
          neighborhoods={neighborhoods}
          picksDefaults={picksDefaults}
          setFilters={setFilters}
          similarityThreshold={searchSlot?.similarityThreshold}
          onReset={handleResetFilters}
          onSimilarityThresholdChange={searchSlot?.onSimilarityThresholdChange}
        />
      </div>

      {/* Mobile drawer */}
      {openFilterDrawer && (
        <>
          <div
            aria-hidden
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setOpenFilterDrawer(false)}
          />
          <div className="border-border bg-surface fixed left-0 top-0 z-50 flex h-full w-full flex-col overflow-hidden border-r shadow-lg sm:w-72 sm:max-w-[85vw] md:hidden">
            <div className="flex shrink-0 items-center justify-between p-3">
              <div className="flex min-h-[44px] flex-1 items-center px-4 py-2">
                <h2 className="text-foreground text-lg font-semibold">
                  Filters
                </h2>
              </div>
              <button
                aria-label="Close filters"
                className="flex h-10 min-h-[44px] min-w-10 shrink-0 items-center justify-center rounded-lg text-foreground hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-border-focus"
                type="button"
                onClick={() => setOpenFilterDrawer(false)}
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div
              aria-label="Filter options"
              className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-3 touch-pan-y [-webkit-overflow-scrolling:touch]"
              role="region"
              style={{ minHeight: 0 }}
            >
              <FilterSidebar
                activeConfigWeights={
                  activeConfigWeights as null | Record<string, number>
                }
                filterLoadError={filterLoadError}
                filters={filters}
                hideTitle
                neighborhoods={neighborhoods}
                picksDefaults={picksDefaults}
                setFilters={setFilters}
                similarityThreshold={searchSlot?.similarityThreshold}
                onReset={() => {
                  handleResetFilters();
                  setOpenFilterDrawer(false);
                }}
                onSimilarityThresholdChange={searchSlot?.onSimilarityThresholdChange}
              />
            </div>
            <div className="border-border flex shrink-0 flex-col gap-2 border-t p-3">
              <button
                className="border-border bg-surface-hover text-foreground w-full rounded border px-3 py-2 text-sm transition-colors hover:bg-surface focus:outline-none focus:ring-2 focus:ring-border-focus"
                type="button"
                onClick={() => {
                  handleResetFilters();
                  setOpenFilterDrawer(false);
                }}
              >
                Clear All Filters
              </button>
              <button
                aria-label="Done"
                className="border-border bg-surface-hover text-foreground w-full rounded border px-3 py-2 text-sm font-medium transition-colors hover:bg-surface focus:outline-none focus:ring-2 focus:ring-border-focus"
                type="button"
                onClick={() => setOpenFilterDrawer(false)}
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}

      {/* Main content: fixed header + scrollable cards (scrollbar at viewport edge) */}
      <div className="bg-background flex min-h-0 flex-1 flex-col overflow-hidden py-6 sm:py-8">
        <div className="relative z-10 flex shrink-0 flex-col gap-3 bg-background px-6 sm:px-8">
          <h1 className="text-foreground text-left text-2xl font-semibold sm:text-3xl">
            Nextdoor Discovery
          </h1>

          {searchSlot && (
          <>
            {/* Compact search (<lg): contents = hoists rows into parent flex so gap-3 matches count row */}
            <div className="contents lg:hidden">
              <FeedSearchBar
                compact
                embeddingBacklog={searchSlot.embeddingBacklog}
                loadDefaultsError={searchSlot.loadDefaultsError}
                loading={searchSlot.loading}
                query={searchSlot.query}
                useKeywordSearch={searchSlot.useKeywordSearch}
                onQueryChange={searchSlot.onQueryChange}
                onSearch={searchSlot.onSearch}
                onUseKeywordSearchChange={searchSlot.onUseKeywordSearchChange}
              />
              {bulkMode ? (
                <div className="mt-1 flex w-full items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <CustomSelect
                      ariaLabel="Bulk action"
                      className="h-8 w-full text-sm"
                      disabled={!selectAllChecked && selectedIds.size === 0}
                      options={feedBulkActionOptions}
                      placeholder="Actions"
                      value=""
                      onChange={(val) => {
                        void handleBulkActionMenuChange(val);
                      }}
                    />
                  </div>
                  <button
                    className="text-foreground hover:opacity-80 flex h-8 w-16 shrink-0 items-center justify-center rounded px-2 text-xs focus:outline-none focus:ring-2 focus:ring-border-focus"
                    type="button"
                    onClick={() => {
                      setBulkMode(false);
                      setSelectAllChecked(false);
                      setSelectedIds(new Set());
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : null}
            </div>
            {searchSlot.loadDefaultsError && (
              <p
                className="hidden text-destructive text-xs lg:block"
                role="alert"
              >
                Defaults failed to load.
              </p>
            )}

            {/* Desktop: from lg – single row, all controls exactly 40px tall */}
            <div className="mb-0 hidden h-[40px] w-full items-center gap-3 lg:mb-2 lg:flex">
              <FeedSearchBar
                embeddingBacklog={searchSlot.embeddingBacklog}
                loadDefaultsError={searchSlot.loadDefaultsError}
                loading={searchSlot.loading}
                query={searchSlot.query}
                toolbar
                useKeywordSearch={searchSlot.useKeywordSearch}
                onQueryChange={searchSlot.onQueryChange}
                onSearch={searchSlot.onSearch}
                onUseKeywordSearchChange={searchSlot.onUseKeywordSearchChange}
              />
              <div className="flex shrink-0 items-center gap-2">
                <button
                  aria-label="Filters"
                  className="border-border bg-surface-hover text-foreground hover:bg-surface flex h-[40px] items-center gap-2 rounded border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus md:hidden"
                  type="button"
                  onClick={() => setOpenFilterDrawer(true)}
                >
                  <Filter className="h-4 w-4" />
                  <span>Filters</span>
                  {activeFilterCount > 0 && (
                    <span className="bg-border text-foreground rounded-full px-1.5 py-0.5 text-xs">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
                <CustomSelect
                  ariaLabel="Sort Posts"
                  className="h-[40px] min-w-0 w-full shrink sm:min-w-[11rem] sm:w-auto"
                  options={SORT_OPTIONS.map((o, i) => ({
                    label: o.label,
                    value: String(i),
                  }))}
                  value={String(SORT_OPTIONS.indexOf(currentSortOption))}
                  onChange={(val) => {
                    const opt = SORT_OPTIONS[Number(val)];
                    if (opt) {
                      setFilters((prev) => ({
                        ...prev,
                        sort: opt.sort,
                        sortOrder: opt.sortOrder,
                      }));
                    }
                  }}
                />
                {bulkMode ? (
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <CustomSelect
                      ariaLabel="Bulk action"
                      className="h-[40px] min-w-0 w-full shrink sm:min-w-[11rem] sm:w-auto"
                      disabled={!selectAllChecked && selectedIds.size === 0}
                      options={feedBulkActionOptions}
                      placeholder="Actions"
                      value=""
                      onChange={(val) => {
                        void handleBulkActionMenuChange(val);
                      }}
                    />
                    <button
                      className="text-foreground hover:opacity-80 flex h-[40px] shrink-0 items-center justify-center rounded-card border border-border bg-transparent px-4 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus sm:w-28"
                      type="button"
                      onClick={() => {
                        setBulkMode(false);
                        setSelectAllChecked(false);
                        setSelectedIds(new Set());
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    className="text-foreground hover:opacity-80 flex h-[40px] min-w-[7.5rem] shrink-0 items-center justify-center whitespace-nowrap rounded-card border border-border bg-transparent px-4 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus"
                    type="button"
                    onClick={() => setBulkMode(true)}
                  >
                    Bulk Actions
                  </button>
                )}
                {(searchSlot.query.trim() || activeFilterCount > 0) && (
                  <button
                    aria-label="Reset filters"
                    className="text-foreground hover:opacity-80 flex h-[40px] min-w-10 shrink-0 items-center justify-center rounded bg-transparent px-2 transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus"
                    type="button"
                    onClick={() => {
                      handleResetFilters();
                      searchSlot.onResetAll?.();
                    }}
                  >
                    <RotateCcw className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {!searchSlot && (
          <>
            <div className="hidden min-w-0 flex-wrap items-center gap-2 lg:flex">
              <button
                aria-label="Filters"
                className="border-border bg-surface-hover text-foreground hover:bg-surface flex h-10 min-h-[44px] items-center gap-2 rounded border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus md:hidden"
                type="button"
                onClick={() => setOpenFilterDrawer(true)}
              >
                <Filter className="h-4 w-4" />
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <span className="bg-border text-foreground rounded-full px-1.5 py-0.5 text-xs">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              <CustomSelect
                ariaLabel="Sort Posts"
                className="h-10 min-w-0 w-full shrink sm:min-w-[11rem] sm:w-auto"
                options={SORT_OPTIONS.map((o, i) => ({
                  label: o.label,
                  value: String(i),
                }))}
                value={String(SORT_OPTIONS.indexOf(currentSortOption))}
                onChange={(val) => {
                  const opt = SORT_OPTIONS[Number(val)];
                  if (opt) {
                    setFilters((prev) => ({
                      ...prev,
                      sort: opt.sort,
                      sortOrder: opt.sortOrder,
                    }));
                  }
                }}
              />
              <button
                aria-label="Reset filters"
                className="text-foreground hover:opacity-80 flex h-10 min-h-[44px] min-w-10 shrink-0 items-center justify-center rounded bg-transparent px-2 transition-colors focus:outline-none focus:ring-2 focus:ring-border-focus"
                type="button"
                onClick={handleResetFilters}
              >
                <RotateCcw className="h-5 w-5" />
              </button>
            </div>
          </>
        )}

        {(!searchSlot || !searchSlot.query.trim()) && (
          <div
            className={cn(
              "bg-background",
              bulkMode && "pr-[17px] lg:pr-7"
            )}
          >
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-1">
                <button
                  aria-label="Filters"
                  className="text-foreground hover:opacity-80 relative flex h-8 w-7 shrink-0 items-center justify-center rounded focus:outline-none focus:ring-2 focus:ring-border-focus md:hidden"
                  type="button"
                  onClick={() => setOpenFilterDrawer(true)}
                >
                  <Filter className="h-4 w-4" />
                  {activeFilterCount > 0 && (
                    <span className="bg-border text-foreground absolute -right-0.5 -top-0.5 rounded-full px-1 py-0.5 text-[10px]">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
                <span className="text-muted-foreground shrink-0 text-sm">
                  Showing {posts.length} of {total} Posts
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <div
                  className={cn(
                    "flex min-w-0 shrink-0 items-center gap-0 lg:hidden",
                    bulkMode && "hidden"
                  )}
                >
                  {searchSlot ? (
                    <>
                      <button
                        aria-label="Bulk Actions"
                        className="text-foreground hover:opacity-80 flex h-8 w-7 shrink-0 items-center justify-center rounded focus:outline-none focus:ring-2 focus:ring-border-focus"
                        type="button"
                        onClick={() => setBulkMode(true)}
                      >
                        <CheckSquare className="h-4 w-4" />
                      </button>
                      <div className="relative" ref={sortMenuRef}>
                        <button
                          aria-expanded={sortMenuOpen}
                          aria-haspopup="menu"
                          aria-label="Sort"
                          className="text-foreground hover:opacity-80 flex h-8 w-7 shrink-0 items-center justify-center rounded focus:outline-none focus:ring-2 focus:ring-border-focus"
                          type="button"
                          onClick={() => setSortMenuOpen((o) => !o)}
                        >
                          <ArrowUpDown className="h-4 w-4" />
                        </button>
                        {sortMenuOpen && (
                          <div
                            className="border-border bg-surface absolute right-0 left-auto top-full z-10 mt-1 min-w-[12rem] rounded-card border py-1 shadow-lg"
                            role="menu"
                          >
                            {SORT_OPTIONS.map((o, i) => (
                              <button
                                key={o.label}
                                className={cn(
                                  "flex w-full px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-border-focus",
                                  currentSortOption.sort === o.sort &&
                                    currentSortOption.sortOrder === o.sortOrder &&
                                    "bg-surface-hover font-medium"
                                )}
                                role="menuitem"
                                type="button"
                                onClick={() => {
                                  setFilters((prev) => ({
                                    ...prev,
                                    sort: o.sort,
                                    sortOrder: o.sortOrder,
                                  }));
                                  setSortMenuOpen(false);
                                }}
                              >
                                {o.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {(searchSlot.query.trim() || activeFilterCount > 0) && (
                        <button
                          aria-label="Reset filters"
                          className="text-foreground hover:opacity-80 flex h-8 w-7 shrink-0 items-center justify-center rounded focus:outline-none focus:ring-2 focus:ring-border-focus"
                          type="button"
                          onClick={() => {
                            handleResetFilters();
                            searchSlot.onResetAll?.();
                          }}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                      )}
                      <div className="relative" ref={searchTypeMenuRef}>
                        <button
                          aria-expanded={searchTypeMenuOpen}
                          aria-haspopup="menu"
                          aria-label="Search type"
                          className="text-foreground hover:opacity-80 flex h-8 w-7 shrink-0 items-center justify-center rounded focus:outline-none focus:ring-2 focus:ring-border-focus"
                          type="button"
                          onClick={() => setSearchTypeMenuOpen((o) => !o)}
                        >
                          <Search className="h-4 w-4" />
                        </button>
                        {searchTypeMenuOpen && (
                          <div
                            className="border-border bg-surface absolute right-0 left-auto top-full z-10 mt-1 min-w-[8rem] rounded-card border py-1 shadow-lg"
                            role="menu"
                          >
                            <button
                              className={cn(
                                "flex w-full px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-border-focus",
                                !searchSlot.useKeywordSearch &&
                                  "bg-surface-hover font-medium"
                              )}
                              role="menuitem"
                              type="button"
                              onClick={() => {
                                searchSlot.onUseKeywordSearchChange(false);
                                setSearchTypeMenuOpen(false);
                              }}
                            >
                              AI Powered
                            </button>
                            <button
                              className={cn(
                                "flex w-full px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-border-focus",
                                searchSlot.useKeywordSearch &&
                                  "bg-surface-hover font-medium"
                              )}
                              role="menuitem"
                              type="button"
                              onClick={() => {
                                searchSlot.onUseKeywordSearchChange(true);
                                setSearchTypeMenuOpen(false);
                              }}
                            >
                              Keyword
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="relative" ref={sortMenuRef}>
                        <button
                          aria-expanded={sortMenuOpen}
                          aria-haspopup="menu"
                          aria-label="Sort"
                          className="text-foreground hover:opacity-80 flex h-8 w-7 shrink-0 items-center justify-center rounded focus:outline-none focus:ring-2 focus:ring-border-focus"
                          type="button"
                          onClick={() => setSortMenuOpen((open) => !open)}
                        >
                          <ArrowUpDown className="h-4 w-4" />
                        </button>
                        {sortMenuOpen && (
                          <div className="border-border bg-surface absolute right-0 left-auto top-full z-20 mt-1 min-w-[11rem] rounded border py-1 shadow-lg">
                            {SORT_OPTIONS.map((opt, i) => (
                              <button
                                key={opt.label}
                                className="text-foreground hover:bg-surface-hover w-full px-3 py-2 text-left text-sm"
                                type="button"
                                onClick={() => {
                                  setFilters((prev) => ({
                                    ...prev,
                                    sort: opt.sort,
                                    sortOrder: opt.sortOrder,
                                  }));
                                  setSortMenuOpen(false);
                                }}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        aria-label="Reset filters"
                        className="text-foreground hover:opacity-80 flex h-8 w-7 shrink-0 items-center justify-center rounded focus:outline-none focus:ring-2 focus:ring-border-focus"
                        type="button"
                        onClick={handleResetFilters}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
                {bulkMode ? (
                  <label
                    className="flex h-8 cursor-pointer items-center gap-2"
                    htmlFor="select-all-feed"
                  >
                    <span className="text-muted-foreground text-sm">
                      Select All
                    </span>
                    <input
                      aria-label="Select All"
                      checked={
                        selectedIds.size === posts.length && posts.length > 0
                      }
                      className="rounded border-border bg-surface-hover"
                      id="select-all-feed"
                      ref={selectAllCheckboxRef}
                      type="checkbox"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(new Set(posts.map((p) => p.id)));
                          setSelectAllChecked(true);
                        } else {
                          setSelectedIds(new Set());
                          setSelectAllChecked(false);
                        }
                      }}
                    />
                  </label>
                ) : null}
              </div>
            </div>
          </div>
        )}

        </div>

        <div
          aria-label="Feed posts"
          className="relative z-0 min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-background pb-6 pt-3 sm:pb-8 sm:pt-4"
          role="region"
          style={{ scrollbarGutter: "stable" }}
        >
        <div className="min-w-0 bg-background px-6 sm:px-8">
        {searchSlot && searchSlot.query.trim() ? (
          <div className="space-y-6">
            {searchSlot.loading && searchSlot.query.trim()
              ? null
              : searchSlot.searchError && (
                <div className="flex justify-center mt-24">
                  <div className="border border-destructive rounded-lg px-6 py-4 text-center text-destructive">
                    <div className="mb-2 flex justify-center">
                      <AlertTriangle aria-hidden className="h-12 w-12" />
                    </div>
                    <p className="text-base font-medium">
                      {GENERIC_ERROR_MESSAGE_LINE_1}
                    </p>
                    <p className="text-base font-medium">
                      {GENERIC_ERROR_MESSAGE_LINE_2}
                    </p>
                  </div>
                </div>
              )}
            {!searchSlot.loading &&
              !searchSlot.searchError &&
              searchSlot.debouncedQuery === searchSlot.query &&
              searchSlot.query.trim() &&
              searchSlot.searchTotal > 0 && (
                <p className="text-muted-foreground text-sm">
                  Found {searchSlot.searchTotal}{" "}
                  {searchSlot.searchTotal === 1 ? "Post" : "Posts"}
                </p>
              )}
            {!searchSlot.loading &&
              searchSlot.query.trim() &&
              searchSlot.debouncedQuery === searchSlot.query &&
              searchSlot.searchTotal === 0 &&
              !searchSlot.searchError && (
                <div className="py-10 text-center">
                  <span className="text-muted-foreground text-sm">
                    <SearchX
                      aria-hidden
                      className="mx-auto mb-4 block h-12 w-12"
                    />
                  </span>
                  <p className="text-foreground mb-3 font-medium">
                    No posts found.
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Try different search terms or lower the similarity
                    threshold.
                  </p>
                </div>
              )}
            {searchSlot.loading && searchSlot.query.trim() && (
              <div
                aria-busy="true"
                aria-label="Loading search results"
                className="space-y-4"
              >
                {Array.from({ length: SKELETON_CARD_COUNT }, (_, i) => (
                  <PostCardSkeleton key={i} />
                ))}
              </div>
            )}
            {!searchSlot.loading &&
              !searchSlot.searchError &&
              searchSlot.results.length > 0 && (
              <div className="space-y-4">
                {searchSlot.results.map((post) => {
                  const activeJob = getActiveJobForPost(post);
                  return (
                    <PostCard
                      key={post.id}
                      activeJobId={activeJob?.id ?? null}
                      isAddAsExampleDisabled={examplesFull}
                      isAddingToScoringFewShot={addingIds.has(post.id)}
                      isMarkingSaved={searchSlot.markingSaved.has(post.id)}
                      post={post}
                      queueStatus={getQueueStatusForPost(post)}
                      similarSearchListPath={similarSearchListPath}
                      onAddToScoringFewShot={handleAddToScoringFewShot}
                      onCancelRefresh={requestCancelRefresh}
                      onMarkSaved={(id, saved) =>
                        searchSlot.onMarkSaved(id, saved)
                      }
                      onMarkUsedChange={(id, used) =>
                        searchSlot.onMarkUsedChange(id, used)
                      }
                      onQueueRefresh={requestQueueRefresh}
                      onViewDetails={() => searchSlot.onViewDetails(post.id)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <>
            {(!searchSlot || !searchSlot.query.trim()) && error ? (
              <div className="mt-24 flex justify-center">
                <div className="border border-destructive rounded-lg px-6 py-4 text-center text-destructive">
                  <div className="mb-2 flex justify-center">
                    <AlertTriangle aria-hidden className="h-12 w-12" />
                  </div>
                  <p className="text-base font-medium">
                    {GENERIC_ERROR_MESSAGE_LINE_1}
                  </p>
                  <p className="text-base font-medium">
                    {GENERIC_ERROR_MESSAGE_LINE_2}
                  </p>
                </div>
              </div>
            ) : null}

        {!error && initialLoading && (
          <div aria-busy="true" aria-label="Loading feed" className="space-y-4">
            {Array.from({ length: SKELETON_CARD_COUNT }, (_, i) => (
              <PostCardSkeleton key={i} />
            ))}
          </div>
        )}

        {!error && !initialLoading && posts.length === 0 && (
          <div className="py-10 text-center">
            <span className="text-muted-foreground text-sm">
              <Inbox
                aria-hidden
                className="mx-auto mb-4 block h-12 w-12"
              />
            </span>
            <p className="text-foreground mb-3 font-medium">
              No posts found.
            </p>
            <p className="text-muted-foreground text-sm">
              Try adjusting your filters or run the scraper to collect posts.
            </p>
          </div>
        )}

        {!error && !initialLoading && posts.length > 0 && (
          <>
            <div className="space-y-4">
              {posts.map((post, index) => (
                <div
                  key={post.id}
                  className={
                    focusedIndex === index
                      ? "rounded-card ring-2 ring-border-focus"
                      : ""
                  }
                  ref={(el) => {
                    postRefs.current[index] = el;
                  }}
                >
                  <PostCard
                    activeJobId={getActiveJobForPost(post)?.id ?? null}
                    isAddAsExampleDisabled={examplesFull}
                    isAddingToScoringFewShot={addingIds.has(post.id)}
                    isMarkingIgnored={markingIgnored.has(post.id)}
                    isMarkingSaved={markingSaved.has(post.id)}
                    isMarkingUsed={markingUsed.has(post.id)}
                    post={post}
                    queueStatus={getQueueStatusForPost(post)}
                    selected={selectedIds.has(post.id)}
                    showCheckbox={bulkMode}
                    similarSearchListPath={similarSearchListPath}
                    onAddToScoringFewShot={handleAddToScoringFewShot}
                    onCancelRefresh={requestCancelRefresh}
                    onMarkIgnored={requestMarkIgnored}
                    onMarkSaved={handleMarkSaved}
                    onMarkUsedChange={requestMarkUsedChange}
                    onQueueRefresh={requestQueueRefresh}
                    onSelect={toggleSelect}
                    onViewDetails={() => router.push(`/admin/posts/${post.id}`)}
                  />
                </div>
              ))}
            </div>

            {hasMore && (
              <div
                className="flex justify-center pb-4 pt-10"
                data-testid="infinite-scroll-sentinel"
                ref={sentinelRef}
              >
                {loadingMore && (
                  <div
                    aria-hidden
                    className="border-border-focus h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
                  />
                )}
              </div>
            )}

            {!hasMore && posts.length > 0 && (
              <div className="text-muted-foreground pt-10 pb-4 text-center text-sm">
                No more posts to load.
              </div>
            )}
          </>
        )}
          </>
        )}
        </div>
        </div>
      </div>

      <ConfirmModal
        cancelLabel="Cancel"
        confirmLabel="Confirm"
        counting={countLoading && confirmModal?.count === undefined}
        message={
          confirmModal?.count != null
            ? `Are you sure you want to ${BULK_ACTION_LABELS[confirmModal.action].toLowerCase()} ${confirmModal.count} post(s)?`
            : undefined
        }
        open={confirmModal != null}
        title={confirmModal ? BULK_ACTION_TITLES[confirmModal.action] : ""}
        onCancel={() => {
          setConfirmModal(null);
          if (countLoading) setCountLoading(false);
        }}
        onConfirm={() => {
          if (confirmModal?.count == null) return;
          const { action, count } = confirmModal;
          const successMessage = `${BULK_ACTION_SUCCESS[action]} ${count} post(s).`;
          const applyToQuery = selectAllChecked;
          setConfirmModal(null);
          setBulkMode(false);
          setSelectAllChecked(false);
          handleBulkAction(action, {
            applyToQuery,
            onError: (message) => toast.error(message),
            onSuccess: (data) => {
              if (
                action === "reprocess" &&
                data?.data?.jobs_queued != null
              ) {
                let msg = `${data.data.jobs_queued} post(s) queued for reprocessing.`;
                if ((data.data.skipped ?? 0) > 0) {
                  msg += ` ${data.data.skipped} skipped (no URL).`;
                }
                toast.success(msg);
                refetchPermalinkJobs();
              } else {
                toast.success(successMessage);
              }
            },
          });
        }}
      />

      <ConfirmModal
        cancelLabel="Cancel"
        confirmLabel="Confirm"
        message={
          pendingPostAction?.action === "ignore"
            ? pendingPostAction.value
              ? "Ignore this post? It will be hidden from the feed."
              : "Show this post in the feed again?"
            : pendingPostAction?.action === "used"
              ? pendingPostAction.value
                ? "Mark this post as used on an episode?"
                : "Mark this post as unused?"
              : pendingPostAction?.action === "cancelRefresh"
                ? "Remove this post from the refresh queue?"
                : pendingPostAction?.action === "queueRefresh"
                  ? "Queue this post for refresh?"
                  : undefined
        }
        open={pendingPostAction != null}
        title={
          pendingPostAction?.action === "ignore"
            ? pendingPostAction.value
              ? "Ignore post?"
              : "Unignore post?"
            : pendingPostAction?.action === "used"
              ? pendingPostAction.value
                ? "Mark as used?"
                : "Mark as unused?"
              : pendingPostAction?.action === "cancelRefresh"
                ? "Cancel refresh?"
                : pendingPostAction?.action === "queueRefresh"
                  ? "Queue refresh?"
                  : ""
        }
        onCancel={() => setPendingPostAction(null)}
        onConfirm={() => {
          if (pendingPostAction == null) return;
          if (pendingPostAction.action === "ignore") {
            handleMarkIgnored(pendingPostAction.postId, pendingPostAction.value ?? false);
          } else if (pendingPostAction.action === "used") {
            handleMarkUsedChange(pendingPostAction.postId, pendingPostAction.value ?? false);
          } else if (pendingPostAction.action === "cancelRefresh") {
            handleCancelRefresh(pendingPostAction.jobId);
          } else if (pendingPostAction.action === "queueRefresh") {
            handleQueueRefresh(pendingPostAction.postId);
          }
          setPendingPostAction(null);
        }}
      />
    </div>
  );
}
