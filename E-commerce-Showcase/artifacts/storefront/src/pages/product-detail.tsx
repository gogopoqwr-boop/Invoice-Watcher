import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetProduct,
  useGetProductReviews,
  useUpdateProductColor,
  useAddToCart,
  useCreateReview,
  getGetProductQueryKey,
  getGetProductReviewsQueryKey,
  getGetCartQueryKey,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { getSessionId } from "@/lib/session";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, ShoppingCart, ArrowLeft, Check, Send } from "lucide-react";
import { format } from "date-fns";

export default function ProductDetail() {
  const [, params] = useRoute("/product/:id");
  const productId = parseInt(params?.id || "0", 10);
  const sessionId = getSessionId();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [quantity, setQuantity] = useState(1);

  const { data: product, isLoading: isLoadingProduct } = useGetProduct(productId, {
    query: { enabled: !!productId, queryKey: getGetProductQueryKey(productId) },
  });

  const { data: reviews, isLoading: isLoadingReviews } = useGetProductReviews(productId, {
    query: { enabled: !!productId, queryKey: getGetProductReviewsQueryKey(productId) },
  });

  const [selectedColor, setSelectedColor] = useState(product?.selectedColor || "");
  const updateColor = useUpdateProductColor();
  const addToCart = useAddToCart();
  const createReview = useCreateReview();

  // Review Form State
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [reviewAuthor, setReviewAuthor] = useState("");

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    if (product) {
      updateColor.mutate(
        { id: product.id, data: { color } },
        {
          onSuccess: (updatedProduct) => {
            queryClient.setQueryData(getGetProductQueryKey(product.id), updatedProduct);
          },
        }
      );
    }
  };

  const handleAddToCart = () => {
    if (!product) return;
    addToCart.mutate(
      {
        data: {
          sessionId,
          productId: product.id,
          quantity,
          selectedColor: selectedColor || product.selectedColor,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCartQueryKey({ sessionId }) });
          toast({
            title: "Added to Cart",
            description: `${quantity}x ${product.name} added to your cart.`,
          });
        },
      }
    );
  };

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewText || !reviewAuthor) return;

    createReview.mutate(
      {
        data: {
          productId,
          author: reviewAuthor,
          rating: reviewRating,
          text: reviewText,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProductReviewsQueryKey(productId) });
          setReviewText("");
          setReviewAuthor("");
          setReviewRating(5);
          toast({
            title: "Review Submitted",
            description: "Thank you for your feedback!",
          });
        },
      }
    );
  };

  if (isLoadingProduct) {
    return (
      <Layout>
        <div className="grid md:grid-cols-2 gap-12 mt-8">
          <Skeleton className="aspect-square rounded-3xl" />
          <div className="space-y-6 pt-4">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!product) {
    return (
      <Layout>
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold mb-4">Product not found</h2>
          <Link href="/">
            <Button>Return to Catalog</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const activeColor = selectedColor || product.selectedColor;
  const fallbackImage = `/images/category-${product.category}.png`;

  return (
    <Layout>
      <div className="mb-6">
        <Link href="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Catalog
        </Link>
      </div>

      <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 mb-20 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="bg-card rounded-3xl border border-white/5 overflow-hidden aspect-square flex items-center justify-center relative p-8 glass-panel">
          <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent mix-blend-screen pointer-events-none" />
          <img
            src={product.imageUrl || fallbackImage}
            alt={product.name}
            className="w-full h-full object-contain filter drop-shadow-[0_0_30px_rgba(0,184,255,0.2)] mix-blend-screen"
            onError={(e) => {
              (e.target as HTMLImageElement).src = fallbackImage;
            }}
          />
        </div>

        <div className="flex flex-col py-4">
          <div className="text-sm font-bold text-primary tracking-widest uppercase mb-3">
            {product.category}
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-6 tracking-tight">
            {product.name}
          </h1>

          <div className="flex items-center gap-4 mb-8">
            <div className="inline-flex items-center gap-1.5 bg-yellow-500/10 text-yellow-500 px-3 py-1 rounded-full border border-yellow-500/20 font-medium">
              <Star className="w-4 h-4 fill-yellow-500" />
              {product.priceStars}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-4 h-4 ${
                      s <= Math.round(product.averageRating || 5)
                        ? "text-primary fill-primary"
                        : "text-muted fill-muted"
                    }`}
                  />
                ))}
              </div>
              <span className="font-medium text-white">{product.averageRating?.toFixed(1) || "5.0"}</span>
              <span>({product.reviewCount || 0} reviews)</span>
            </div>
          </div>

          <p className="text-muted-foreground text-lg leading-relaxed mb-10">
            {product.description || "Premium electronics designed for peak performance and aesthetics."}
          </p>

          <div className="space-y-4 mb-10">
            <h3 className="text-sm font-medium text-white uppercase tracking-wider">Select Color</h3>
            <div className="flex gap-3">
              {product.colors.map((color) => (
                <button
                  key={color}
                  onClick={() => handleColorSelect(color)}
                  className={`w-12 h-12 rounded-full border-2 transition-all flex items-center justify-center shadow-lg ${
                    activeColor === color
                      ? "border-primary scale-110 shadow-[0_0_20px_rgba(0,184,255,0.4)]"
                      : "border-white/10 hover:border-white/30 hover:scale-105"
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                >
                  {activeColor === color && (
                    <Check className="w-5 h-5 text-black drop-shadow-md" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-auto p-6 bg-card/50 rounded-2xl border border-white/5 flex flex-col sm:flex-row gap-4">
            <div className="flex items-center border border-white/10 rounded-xl bg-black/40 px-2 h-14">
              <button
                className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-white transition-colors"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              >
                -
              </button>
              <div className="w-10 text-center font-bold text-white">{quantity}</div>
              <button
                className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-white transition-colors"
                onClick={() => setQuantity((q) => q + 1)}
              >
                +
              </button>
            </div>
            
            <Button
              size="lg"
              className="flex-1 h-14 text-base font-bold shadow-[0_0_20px_rgba(0,184,255,0.3)] hover:shadow-[0_0_30px_rgba(0,184,255,0.6)] transition-all"
              onClick={handleAddToCart}
              disabled={addToCart.isPending}
            >
              <ShoppingCart className="w-5 h-5 mr-2" />
              Add to Cart
            </Button>
          </div>
        </div>
      </div>

      <div className="border-t border-white/5 pt-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold text-white">Reviews</h2>
        </div>

        <div className="grid lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-6">
            {isLoadingReviews ? (
              [1, 2].map((i) => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)
            ) : reviews?.length === 0 ? (
              <div className="text-center py-12 bg-card/30 rounded-2xl border border-white/5">
                <p className="text-muted-foreground">No reviews yet. Be the first!</p>
              </div>
            ) : (
              reviews?.map((review) => (
                <div key={review.id} className="p-6 bg-card rounded-2xl border border-white/5">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="font-bold text-white mb-1">{review.author}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(review.createdAt), "MMM d, yyyy")}
                      </div>
                    </div>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-4 h-4 ${
                            s <= review.rating ? "text-primary fill-primary" : "text-muted fill-muted"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-muted-foreground">{review.text}</p>
                  {review.imageUrls && review.imageUrls.length > 0 && (
                    <div className="flex gap-2 mt-4">
                      {review.imageUrls.map((url, i) => (
                        <div key={i} className="w-16 h-16 rounded-lg bg-black/50 overflow-hidden border border-white/10">
                          <img src={url} alt="Review attachment" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="bg-card p-6 rounded-2xl border border-white/5 h-fit sticky top-24">
            <h3 className="text-xl font-bold text-white mb-6">Write a Review</h3>
            <form onSubmit={handleReviewSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Rating</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setReviewRating(s)}
                      className="p-1 hover:scale-110 transition-transform"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          s <= reviewRating ? "text-primary fill-primary" : "text-muted fill-muted"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Name</label>
                <input
                  required
                  type="text"
                  value={reviewAuthor}
                  onChange={(e) => setReviewAuthor(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Review</label>
                <textarea
                  required
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  rows={4}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none"
                  placeholder="What did you think?"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-12 font-bold"
                disabled={createReview.isPending || !reviewText || !reviewAuthor}
              >
                {createReview.isPending ? "Submitting..." : (
                  <>
                    <Send className="w-4 h-4 mr-2" /> Submit Review
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
}
