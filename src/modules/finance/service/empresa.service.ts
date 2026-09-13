import { Injectable } from '@nestjs/common';
import { EmpresaRepository } from '@finance/repositories/empresa.repository';
import { CreateEmpresaDto } from '@finance/dto/empresa/create-empresa.dto';
import { UpdateEmpresaDto } from '@finance/dto/empresa/update-empresa.dto';

@Injectable()
export class EmpresaService {
  constructor(private readonly empresaRepository: EmpresaRepository) {}

  async create(userId: number, dto: CreateEmpresaDto) {
    return this.empresaRepository.create(userId, dto);
  }

  async findAll(userId: number) {
    return this.empresaRepository.findAll(userId);
  }

  async findOne(id: number, userId: number) {
    return this.empresaRepository.findById(id, userId);
  }

  async update(id: number, userId: number, dto: UpdateEmpresaDto) {
    return this.empresaRepository.update(id, userId, dto);
  }

  async remove(id: number, userId: number) {
    return this.empresaRepository.softDelete(id, userId);
  }
}
