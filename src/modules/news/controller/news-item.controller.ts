import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@auth/guards/auth.guard';
import { AdminGuard } from '@auth/guards/admin.guard';
import { ApiIntrospectGuardResponse } from '@auth/decorators/api-introspect-guard-response.decorator';
import { NewsItemService } from '@news/service/news-item.service';
import { NewsQueryDto } from '@news/dto/news-query.dto';
import { CreateNewsItemDto } from '@news/dto/create-news-item.dto';
import { UpdateNewsItemDto } from '@news/dto/update-news-item.dto';
import { NewsItemResponseDto } from '@news/dto/news-item-response.dto';
import { ErrorResponseDto } from '@shared/dto/error-response.dto';

@ApiTags('news')
@UseGuards(AuthGuard)
@ApiIntrospectGuardResponse()
@ApiBearerAuth('bearer')
@Controller('news')
export class NewsItemController {
  constructor(private readonly newsItemService: NewsItemService) {}

  @Post()
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear una nueva noticia (admin)' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Noticia creada exitosamente.',
    type: NewsItemResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error al crear la noticia.',
    type: ErrorResponseDto,
  })
  async create(@Body() dto: CreateNewsItemDto): Promise<NewsItemResponseDto> {
    return this.newsItemService.create(dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener las últimas noticias financieras' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista de noticias.',
    type: NewsItemResponseDto,
    isArray: true,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error al obtener las noticias.',
    type: ErrorResponseDto,
  })
  async findAll(@Query() query: NewsQueryDto): Promise<NewsItemResponseDto[]> {
    return this.newsItemService.findAll(query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener una noticia por ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Noticia encontrada.',
    type: NewsItemResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Noticia no encontrada.',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error al obtener la noticia.',
    type: ErrorResponseDto,
  })
  async findById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<NewsItemResponseDto> {
    return this.newsItemService.findById(id);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualizar una noticia (admin)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Noticia actualizada exitosamente.',
    type: NewsItemResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Noticia no encontrada.',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error al actualizar la noticia.',
    type: ErrorResponseDto,
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateNewsItemDto,
  ): Promise<NewsItemResponseDto> {
    return this.newsItemService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una noticia (admin)' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Noticia eliminada exitosamente.',
  })
  @ApiNotFoundResponse({
    description: 'Noticia no encontrada.',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error al eliminar la noticia.',
    type: ErrorResponseDto,
  })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.newsItemService.remove(id);
  }
}
