import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProfileBucketEnum, TransactionTypeEnum } from '@shared/enums';

export class CategoryResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Alimentación' })
  name!: string;

  @ApiProperty({ enum: TransactionTypeEnum })
  group_type!: TransactionTypeEnum;

  @ApiPropertyOptional({
    enum: ProfileBucketEnum,
    example: ProfileBucketEnum.NEEDS,
    nullable: true,
  })
  profile_bucket!: ProfileBucketEnum | null;

  @ApiPropertyOptional({ example: 'food-fork-drink', nullable: true })
  icon_key!: string | null;

  @ApiPropertyOptional({ example: '#FF5733', nullable: true })
  color_hex!: string | null;

  @ApiProperty({ example: 0 })
  sort_order!: number;

  @ApiProperty({ example: true })
  is_active!: boolean;

  @ApiProperty({ example: '2026-04-25T10:00:00.000Z' })
  created_at!: Date;
}
