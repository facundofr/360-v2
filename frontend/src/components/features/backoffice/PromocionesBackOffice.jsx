import { useEffect, useMemo, useState } from "react";
import { Container, Row, Col, Card, Button, Table, Badge, Modal, Form, InputGroup, Spinner, Alert } from "@/components/compat/bootstrap";
import axios from "axios";
import { FaPlus, FaEdit, FaTrash, FaSync, FaSearch, FaToggleOn, FaToggleOff } from "@/lib/icons";
import { API_URL } from "../../config";

const estadoBadge = (activa) => (
	<Badge bg={activa ? "success" : "secondary"}>{activa ? "Activa" : "Inactiva"}</Badge>
);

const formatearFecha = (fecha) => {
	if (!fecha) return "-";
	try {
		return new Date(fecha).toLocaleString("es-AR", {
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
		});
	} catch (e) {
		return fecha;
	}
};

const initialForm = {
	id: null,
	nombre: "",
	descripcion: "",
	descuento_porcentaje: 0,
	tipo: "descuento",
	activa: true,
};

const tipoBadge = (tipo) => (
	<Badge bg={tipo === "incremento" ? "warning" : "info"} text={tipo === "incremento" ? "dark" : undefined}>
		{tipo === "incremento" ? "Incremento" : "Descuento"}
	</Badge>
);

const PromocionesBackOffice = () => {
	const [promociones, setPromociones] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [busqueda, setBusqueda] = useState("");
	const [soloActivas, setSoloActivas] = useState(false);
	const [showModal, setShowModal] = useState(false);
	const [formData, setFormData] = useState(initialForm);
	const [saving, setSaving] = useState(false);
	const [userRole, setUserRole] = useState(null);
	const [isReadOnly, setIsReadOnly] = useState(false);

	useEffect(() => {
		// Obtener rol del usuario desde localStorage
		const role = localStorage.getItem("cober_user_role");
		setUserRole(parseInt(role, 10));
		// Rol 2 = Supervisor (solo lectura)
		setIsReadOnly(parseInt(role, 10) === 2);
		fetchPromociones();
	}, []);

	const fetchPromociones = async () => {
		try {
			setLoading(true);
			const token = localStorage.getItem("cober_token");
			const { data } = await axios.get(`${API_URL}/backoffice/promociones`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			setPromociones(data || []);
			setError("");
		} catch (err) {
			console.error("Error al obtener promociones", err);
			setError(err.response?.data?.message || "No se pudieron cargar las promociones.");
		} finally {
			setLoading(false);
		}
	};

	const promocionesFiltradas = useMemo(() => {
		const term = busqueda.trim().toLowerCase();
		return promociones
			.filter((p) => !soloActivas || p.activa)
			.filter(
				(p) =>
					!term ||
					p.nombre?.toLowerCase().includes(term) ||
					p.descripcion?.toLowerCase().includes(term) ||
					String(p.descuento_porcentaje).includes(term)
			)
			.sort((a, b) => b.id - a.id);
	}, [promociones, busqueda, soloActivas]);

	const abrirModal = (promo = initialForm) => {
		setFormData({
			id: promo.id ?? null,
			nombre: promo.nombre || "",
			descripcion: promo.descripcion || "",
			descuento_porcentaje: promo.descuento_porcentaje ?? 0,
			tipo: promo.tipo || "descuento",
			activa: promo.activa ?? true,
		});
		setShowModal(true);
	};

	const cerrarModal = () => {
		setShowModal(false);
		setFormData(initialForm);
	};

	const handleChange = (e) => {
		const { name, value, type, checked } = e.target;
		setFormData((prev) => ({
			...prev,
			[name]: type === "checkbox" ? checked : value,
		}));
	};

	const validarForm = () => {
		if (!formData.nombre.trim()) return "El nombre es obligatorio";
		if (!formData.descripcion.trim()) return "La descripción es obligatoria";
		const descuento = Number(formData.descuento_porcentaje);
		if (Number.isNaN(descuento) || descuento < 0 || descuento > 100) {
			return "El porcentaje debe estar entre 0% y 100%";
		}
		return "";
	};

	const guardarPromocion = async () => {
		const validationError = validarForm();
		if (validationError) {
			setError(validationError);
			return;
		}

		try {
			setSaving(true);
			setError("");
			const token = localStorage.getItem("cober_token");
			const payload = {
				nombre: formData.nombre.trim(),
				descripcion: formData.descripcion.trim(),
				descuento_porcentaje: Number(formData.descuento_porcentaje),
				tipo: formData.tipo,
				activa: formData.activa,
			};

			if (formData.id) {
				await axios.put(`${API_URL}/backoffice/promociones/${formData.id}`, payload, {
					headers: { Authorization: `Bearer ${token}` },
				});
			} else {
				await axios.post(`${API_URL}/backoffice/promociones`, payload, {
					headers: { Authorization: `Bearer ${token}` },
				});
			}

			cerrarModal();
			fetchPromociones();
		} catch (err) {
			console.error("Error al guardar promoción", err);
			setError(err.response?.data?.message || "No se pudo guardar la promoción.");
		} finally {
			setSaving(false);
		}
	};

	const eliminarPromocion = async (promo) => {
		const confirmar = window.confirm(`¿Eliminar la promoción "${promo.nombre}"?`);
		if (!confirmar) return;

		try {
			setSaving(true);
			const token = localStorage.getItem("cober_token");
			await axios.delete(`${API_URL}/backoffice/promociones/${promo.id}`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			fetchPromociones();
		} catch (err) {
			console.error("Error al eliminar promoción", err);
			setError(err.response?.data?.message || "No se pudo eliminar la promoción.");
		} finally {
			setSaving(false);
		}
	};

	const toggleActiva = async (promo) => {
		try {
			const token = localStorage.getItem("cober_token");
			await axios.put(
				`${API_URL}/backoffice/promociones/${promo.id}`,
				{ ...promo, activa: !promo.activa },
				{ headers: { Authorization: `Bearer ${token}` } }
			);
			fetchPromociones();
		} catch (err) {
			console.error("Error al actualizar estado", err);
			setError(err.response?.data?.message || "No se pudo actualizar el estado.");
		}
	};

	return (
		<Container fluid className="p-0">
			<Row className="[--gx:1rem] [--gy:1rem]">
				<Col xs={12}>
					<Card className="shadow-xs">
						<Card.Header className="flex justify-between items-center">
							<div>
								<Card.Title as="h5" className="mb-0">Promociones</Card.Title>
								<Card.Subtitle className="text-muted-foreground">
									{isReadOnly ? "Vista de lectura - Solo supervisores pueden ver" : "Gestiona descuentos, incrementos y estados"}
								</Card.Subtitle>
							</div>
							<div className="flex items-center gap-2">
								<Button variant="outline-secondary" size="sm" onClick={fetchPromociones} disabled={loading}>
									<FaSync className={loading ? "animate-spin" : ""} />
								</Button>
								{!isReadOnly && (
									<Button variant="success" size="sm" onClick={() => abrirModal()}>
										<FaPlus className="me-1" /> Nueva promoción
									</Button>
								)}
							</div>
						</Card.Header>

						<Card.Body>
							{error && <Alert variant="danger" className="mb-4">{error}</Alert>}
							{isReadOnly && (
								<Alert variant="info" className="mb-4">
									<strong>Acceso de Lectura:</strong> Como supervisor, puedes ver las promociones pero no puedes crearlas, editarlas ni eliminarlas.
								</Alert>
							)}

							<Row className="items-center mb-4 [--gx:0.5rem] [--gy:0.5rem]">
								<Col md={6}>
									<InputGroup>
										<InputGroup.Text><FaSearch /></InputGroup.Text>
										<Form.Control
											placeholder="Buscar por nombre, descripción o porcentaje"
											value={busqueda}
											onChange={(e) => setBusqueda(e.target.value)}
										/>
									</InputGroup>
								</Col>
								<Col md={3} className="flex items-center gap-2">
									<Form.Check
										type="switch"
										id="solo-activas"
										label="Solo activas"
										checked={soloActivas}
										onChange={(e) => setSoloActivas(e.target.checked)}
									/>
								</Col>
							</Row>

							{loading ? (
								<div className="flex justify-center py-6">
									<Spinner animation="border" variant="primary" />
								</div>
							) : (
								<div className="w-full overflow-x-auto">
									<Table hover className="align-middle mb-0">
										<thead className="bg-muted/60">
											<tr>
												<th className="text-left">ID</th>
												<th className="text-left">Nombre</th>
												<th className="text-left">Descripción</th>
												<th className="text-center">Tipo</th>
												<th className="text-center">Porcentaje</th>
												<th className="text-center">Estado</th>
												<th className="text-left">Creación</th>
												{!isReadOnly && <th className="text-right" style={{ width: 160 }}>Acciones</th>}
											</tr>
										</thead>
										<tbody>
											{promocionesFiltradas.length === 0 && (
												<tr>
													<td colSpan={isReadOnly ? 7 : 8} className="text-center py-6 text-muted-foreground">
														No hay promociones para mostrar
													</td>
												</tr>
											)}
											{promocionesFiltradas.map((promo) => (
												<tr key={promo.id}>
													<td>{promo.id}</td>
													<td className="font-semibold">{promo.nombre}</td>
													<td className="text-muted-foreground" style={{ maxWidth: 320 }}>{promo.descripcion}</td>
													<td className="text-center">{tipoBadge(promo.tipo)}</td>
													<td className="text-center font-semibold">
														{promo.tipo === "incremento" ? "+" : "-"}{promo.descuento_porcentaje}%
													</td>
													<td className="text-center">{estadoBadge(promo.activa)}</td>
													<td>{formatearFecha(promo.fecha_creacion)}</td>
													{!isReadOnly && (
														<td className="text-right">
															<div className="inline-flex gap-2">
																<Button
																	variant="outline-secondary"
																	size="sm"
																	onClick={() => toggleActiva(promo)}
																	title={promo.activa ? "Desactivar" : "Activar"}
																>
																	{promo.activa ? <FaToggleOn /> : <FaToggleOff />}
																</Button>
																<Button variant="outline-primary" size="sm" onClick={() => abrirModal(promo)}>
																	<FaEdit />
																</Button>
																<Button variant="outline-danger" size="sm" onClick={() => eliminarPromocion(promo)}>
																	<FaTrash />
																</Button>
															</div>
														</td>
													)}
												</tr>
											))}
										</tbody>
									</Table>
								</div>
							)}
						</Card.Body>
					</Card>
				</Col>
			</Row>

			{!isReadOnly && (
				<Modal show={showModal} onHide={cerrarModal} centered backdrop="static">
					<Modal.Header closeButton>
						<Modal.Title>{formData.id ? "Editar promoción" : "Nueva promoción"}</Modal.Title>
					</Modal.Header>
					<Modal.Body>
						<Form>
							<Form.Group className="mb-4">
								<Form.Label>Nombre</Form.Label>
								<Form.Control
									name="nombre"
									value={formData.nombre}
									onChange={handleChange}
									placeholder="Ej: Promo verano"
								/>
							</Form.Group>

							<Form.Group className="mb-4">
								<Form.Label>Descripción</Form.Label>
								<Form.Control
									as="textarea"
									rows={2}
									name="descripcion"
									value={formData.descripcion}
									onChange={handleChange}
									placeholder="Beneficio o condiciones"
								/>
							</Form.Group>

							<Form.Group className="mb-4">
								<Form.Label>Tipo de promoción</Form.Label>
								<Form.Select name="tipo" value={formData.tipo} onChange={handleChange}>
									<option value="descuento">Descuento (resta al precio)</option>
									<option value="incremento">Incremento (suma al precio)</option>
								</Form.Select>
							</Form.Group>

							<Form.Group className="mb-4">
								<Form.Label>{formData.tipo === "incremento" ? "Incremento (%)" : "Descuento (%)"}</Form.Label>
								<InputGroup>
									<Form.Control
										type="number"
										name="descuento_porcentaje"
										min="0"
										max="100"
										step="0.01"
										value={formData.descuento_porcentaje}
										onChange={handleChange}
									/>
									<InputGroup.Text>%</InputGroup.Text>
								</InputGroup>
								<Form.Text className="text-muted-foreground">
									Entre 0 y 100. Usa 0 para una promoción sin efecto en el precio.
								</Form.Text>
							</Form.Group>

							<Form.Check
								type="switch"
								id="activa"
								name="activa"
								label="Promoción activa"
								checked={formData.activa}
								onChange={handleChange}
							/>
						</Form>
					</Modal.Body>
					<Modal.Footer>
						<Button variant="outline-secondary" onClick={cerrarModal} disabled={saving}>
							Cancelar
						</Button>
						<Button variant="success" onClick={guardarPromocion} disabled={saving}>
							{saving ? <Spinner size="sm" animation="border" /> : "Guardar"}
						</Button>
					</Modal.Footer>
				</Modal>
			)}
		</Container>
	);
};

export default PromocionesBackOffice;
