import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '@common/decorators/public.decorator';
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe';
import { SearchService } from '../../application/search.service';
import { SearchQuerySchema } from '../../application/dto/search.dto';
import type { SearchQueryDto } from '../../application/dto/search.dto';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @Public()
  search(@Query(new ZodValidationPipe(SearchQuerySchema)) query: SearchQueryDto) {
    return this.searchService.search(query);
  }
}
