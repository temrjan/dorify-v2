import { Controller, Get, Post, Put, Delete, Param, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { Public } from '@common/decorators/public.decorator';
import { Roles, UserRole } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe';
import { CatalogService } from '../../application/catalog.service';
import {
  CreateProductSchema,
  UpdateProductSchema,
  ModerateProductSchema,
  ProductFiltersSchema,
} from '../../application/dto/product.dto';
import type {
  CreateProductDto,
  UpdateProductDto,
  ModerateProductDto,
  ProductFiltersDto,
} from '../../application/dto/product.dto';

// ── Public endpoints ────────────────────────────────────────

@Controller('products')
export class PublicProductController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  @Public()
  listProducts(@Query(new ZodValidationPipe(ProductFiltersSchema)) filters: ProductFiltersDto) {
    return this.catalogService.listPublicProducts(filters);
  }

  @Get(':id')
  @Public()
  getProduct(@Param('id') id: string) {
    return this.catalogService.getProduct(id);
  }
}

// ── Pharmacy owner endpoints ────────────────────────────────

@Controller('pharmacy/products')
@Roles(UserRole.PHARMACY_OWNER)
export class PharmacyProductController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  listMyProducts(@Query(new ZodValidationPipe(ProductFiltersSchema)) filters: ProductFiltersDto) {
    return this.catalogService.listMyProducts(filters);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createProduct(@Body(new ZodValidationPipe(CreateProductSchema)) dto: CreateProductDto) {
    return this.catalogService.createProduct(dto);
  }

  @Put(':id')
  updateProduct(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateProductSchema)) dto: UpdateProductDto,
  ) {
    return this.catalogService.updateProduct(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteProduct(@Param('id') id: string) {
    return this.catalogService.deleteProduct(id);
  }
}

// ── Admin endpoints ─────────────────────────────────────────

@Controller('admin/products')
@Roles(UserRole.ADMIN)
export class AdminProductController {
  constructor(private readonly catalogService: CatalogService) {}

  @Put(':id/moderate')
  moderateProduct(
    @Param('id') id: string,
    @CurrentUser('id') moderatorId: string,
    @Body(new ZodValidationPipe(ModerateProductSchema)) dto: ModerateProductDto,
  ) {
    return this.catalogService.moderateProduct(id, moderatorId, dto);
  }
}
