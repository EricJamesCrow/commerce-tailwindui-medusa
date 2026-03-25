import { MedusaService } from "@medusajs/framework/utils";
import Review from "./models/review";
import ReviewStats from "./models/review-stats";
import ReviewResponse from "./models/review-response";
import ReviewImage from "./models/review-image";

class ProductReviewModuleService extends MedusaService({
  Review,
  ReviewStats,
  ReviewResponse,
  ReviewImage,
}) {
  private async getProductStats(productId: string) {
    const stats = await this.listReviewStats({ product_id: productId });
    return stats[0];
  }

  async getAverageRating(productId: string): Promise<number> {
    const stat = await this.getProductStats(productId);
    return stat?.average_rating ?? 0;
  }

  async getRatingDistribution(
    productId: string,
  ): Promise<{ rating: number; count: number }[]> {
    const stat = await this.getProductStats(productId);

    if (!stat) {
      return [];
    }

    return ([5, 4, 3, 2, 1] as const)
      .map((rating) => ({
        rating,
        count: stat[`rating_count_${rating}`] as number,
      }))
      .filter((entry) => entry.count > 0);
  }

  async refreshProductReviewStats(productId: string): Promise<void> {
    const calculated = await this.calculateProductReviewStats(productId);

    const existing = await this.listReviewStats({ product_id: productId });

    if (existing[0]) {
      await this.updateReviewStats({
        id: existing[0].id,
        ...calculated,
      });
    } else {
      try {
        await this.createReviewStats({
          product_id: productId,
          ...calculated,
        });
      } catch {
        // Unique constraint race: another request created the row first
        const [stat] = await this.listReviewStats({ product_id: productId });
        if (stat) {
          await this.updateReviewStats({ id: stat.id, ...calculated });
        }
      }
    }
  }

  async calculateProductReviewStats(productId: string): Promise<{
    average_rating: number;
    review_count: number;
    rating_count_1: number;
    rating_count_2: number;
    rating_count_3: number;
    rating_count_4: number;
    rating_count_5: number;
  }> {
    const reviews = await this.listReviews({
      product_id: productId,
      status: "approved",
    });

    const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalRating = 0;

    for (const review of reviews) {
      const rounded = Math.round(review.rating) as 1 | 2 | 3 | 4 | 5;
      if (rounded >= 1 && rounded <= 5) {
        ratingCounts[rounded]++;
      }
      totalRating += review.rating;
    }

    const reviewCount = reviews.length;
    const averageRating =
      reviewCount > 0 ? parseFloat((totalRating / reviewCount).toFixed(2)) : 0;

    return {
      average_rating: averageRating,
      review_count: reviewCount,
      rating_count_1: ratingCounts[1],
      rating_count_2: ratingCounts[2],
      rating_count_3: ratingCounts[3],
      rating_count_4: ratingCounts[4],
      rating_count_5: ratingCounts[5],
    };
  }
}

export default ProductReviewModuleService;
