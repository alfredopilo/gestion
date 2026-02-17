-- CreateEnum
CREATE TYPE "GradeRoundingMethod" AS ENUM ('TRUNCATE', 'ROUND');

-- AlterTable Institution: configuración de redondeo/truncamiento por tipo de promedio
ALTER TABLE "institutions" ADD COLUMN "grade_rounding_sub_period_method" "GradeRoundingMethod",
ADD COLUMN "grade_rounding_weighted_method" "GradeRoundingMethod",
ADD COLUMN "grade_rounding_period_weighted_method" "GradeRoundingMethod",
ADD COLUMN "grade_decimals" INTEGER DEFAULT 2;

-- AlterTable Period: misma configuración (prioridad sobre institución)
ALTER TABLE "periods" ADD COLUMN "grade_rounding_sub_period_method" "GradeRoundingMethod",
ADD COLUMN "grade_rounding_weighted_method" "GradeRoundingMethod",
ADD COLUMN "grade_rounding_period_weighted_method" "GradeRoundingMethod",
ADD COLUMN "grade_decimals" INTEGER DEFAULT 2;
