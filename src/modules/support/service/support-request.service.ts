import { Injectable } from '@nestjs/common';
import { SupportRequestRepository } from '@support/repositories/support-request.repository';
import { SupportRequest } from '@support/entities/support-request.entity';
import { CreateSupportRequestDto } from '@support/dto/support-request/create-support-request.dto';
import { UpdateSupportRequestDto } from '@support/dto/support-request/update-support-request.dto';

@Injectable()
export class SupportRequestService {
  constructor(
    private readonly supportRequestRepository: SupportRequestRepository,
  ) {}

  create(
    userId: number,
    dto: CreateSupportRequestDto,
  ): Promise<SupportRequest> {
    return this.supportRequestRepository.create(userId, dto);
  }

  findAll(userId: number): Promise<SupportRequest[]> {
    return this.supportRequestRepository.findByUser(userId);
  }

  findOne(id: number, userId: number): Promise<SupportRequest> {
    return this.supportRequestRepository.findByIdAndUser(id, userId);
  }

  remove(id: number, userId: number): Promise<void> {
    return this.supportRequestRepository.softDelete(id, userId);
  }

  findAllAdmin(): Promise<SupportRequest[]> {
    return this.supportRequestRepository.findAllAdmin();
  }

  updateAdmin(
    id: number,
    dto: UpdateSupportRequestDto,
  ): Promise<SupportRequest> {
    return this.supportRequestRepository.updateAdmin(id, dto);
  }
}
