import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useListProducts, useGetProductsSummary, getListProductsQueryKey } from "@workspace/api-client-react";
import type { ListProductsCategory } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { ProductCard } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Filter } from "lucide-react";

export default function Home() {
  const [category, setCategory] = useState<ListProductsCategory | undefined>(undefined);
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data: summary } = useGetProductsSummary();
  const { data: response, isLoading } = useListProducts(
    { category, page, limit },
    {
      query: {
        queryKey: getListProductsQueryKey({ category, page, limit }),
      },
    }
  );

  const categories: { id: ListProductsCategory | undefined; label: string; count?: number }[] = [
    { id: undefined, label: "All Products", count: summary?.total },
    { id: "phones", label: "Phones", count: summary?.byCategory?.phones },
    { id: "laptops", label: "Laptops", count: summary?.byCategory?.laptops },
    { id: "headsets", label: "Headsets", count: summary?.byCategory?.headsets },
    { id: "accessories", label: "Accessories", count: summary?.byCategory?.accessories },
  ];

  return (
    <Layout>
      <div className="mb-8 md:mb-12 text-center max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tighter text-white mb-4">
          Tech Redefined.
        </h1>
        <p className="text-lg text-muted-foreground">
          Premium gear for the modern operative. Fast, secure checkout with Telegram Stars ⭐.
        </p>
      </div>

      <div className="flex overflow-x-auto pb-4 mb-8 gap-2 no-scrollbar animate-in fade-in duration-700 delay-200">
        {categories.map((c) => (
          <button
            key={c.id || "all"}
            onClick={() => {
              setCategory(c.id);
              setPage(1);
            }}
            className={`px-5 py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-all border flex items-center gap-2 ${
              category === c.id
                ? "bg-primary text-primary-foreground border-primary shadow-[0_0_15px_rgba(0,184,255,0.3)]"
                : "bg-card/50 text-muted-foreground border-white/5 hover:border-primary/50 hover:text-white"
            }`}
          >
            {c.label}
            {c.count !== undefined && (
              <span className={`px-2 py-0.5 rounded-full text-xs ${category === c.id ? "bg-primary-foreground/20" : "bg-white/10"}`}>
                {c.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {Array.from({ length: limit }).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl border border-white/5 overflow-hidden flex flex-col">
              <Skeleton className="aspect-square rounded-none" />
              <div className="p-5 flex flex-col gap-4">
                <div>
                  <Skeleton className="h-3 w-16 mb-2" />
                  <Skeleton className="h-5 w-full mb-1" />
                  <Skeleton className="h-5 w-2/3" />
                </div>
                <div className="mt-auto flex justify-between">
                  <Skeleton className="h-8 w-24 rounded-full" />
                  <Skeleton className="h-10 w-10 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : response?.products?.length === 0 ? (
        <div className="py-20 text-center border border-white/5 bg-card/30 rounded-2xl glass-panel">
          <Filter className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-xl font-semibold text-white mb-2">No products found</h3>
          <p className="text-muted-foreground">Try selecting a different category.</p>
          <Button variant="outline" className="mt-6" onClick={() => setCategory(undefined)}>
            View all products
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {response?.products?.map((product, index) => (
              <ProductCard key={product.id} product={product} index={index} />
            ))}
          </div>

          {response && Math.ceil(response.total / response.limit) > 1 && (
            <div className="mt-12 flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-full w-12 h-12 border-white/10 hover:border-primary/50 hover:text-primary transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div className="text-sm font-medium">
                Page <span className="text-white">{page}</span> of {Math.ceil(response.total / response.limit)}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= Math.ceil(response.total / response.limit)}
                className="rounded-full w-12 h-12 border-white/10 hover:border-primary/50 hover:text-primary transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
